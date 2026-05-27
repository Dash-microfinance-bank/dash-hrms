'use server'

import { revalidatePath } from 'next/cache'
import { getPayrollAdminContext } from '@/lib/actions/payroll-runs'
import { ensureOrganizationsBucket } from '@/lib/avatar-upload/ensure-bucket'
import type { PayrollRunType } from '@/lib/data/payroll-runs'
import { chunkArray } from '@/lib/payslips/batch'
import { renderPayslipPdfBuffer } from '@/lib/payslips/generate-payslip-pdf'
import {
  mapEntryToPayslipViewModel,
  type PayslipEntryInput,
} from '@/lib/payslips/map-entry-to-view-model'
import { buildPayslipObjectPath } from '@/lib/payslips/storage-path'
import { uploadPayslipPdf } from '@/lib/payslips/upload-payslip'
import type { AllowanceBreakdownItem } from '@/lib/payroll/gross-calculator'
import type { PayrollDeductionBreakdownItem } from '@/lib/payroll/tax-calculator'
import {
  PAYROLL_APPROVAL_ENTITY_TYPE,
  PAYROLL_APPROVAL_REQUEST_TYPE,
} from '@/lib/payroll-approval-constants'
import { createAdminClient } from '@/lib/supabase/admin'

const PAYROLL_PATH = '/dashboard/admin/payroll'
const PAYSLIP_BATCH_SIZE = 10

export type LockPayrollRunResult =
  | { success: true; generated: number; failed: number; total: number }
  | { success: false; error: string }

type RawPayrollEntry = {
  id: string
  employee_id: string
  net_salary: number | string
  allowance_breakdown: AllowanceBreakdownItem[] | unknown
  deductions_breakdown: PayrollDeductionBreakdownItem[] | unknown
}

type RawEmployee = {
  id: string
  staff_id: string | null
  contract_type: string | null
  department_id: string | null
  job_role_id: string | null
}

function revalidatePayrollRun(payrollRunId: string) {
  revalidatePath(PAYROLL_PATH)
  revalidatePath(`${PAYROLL_PATH}/${payrollRunId}`)
}

function parseBreakdown<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[]
  return []
}

export async function lockPayrollRun(payrollRunId: string): Promise<LockPayrollRunResult> {
  const ctx = await getPayrollAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const { supabase, orgId, userId } = ctx

  const { data: run, error: runError } = await supabase
    .from('payroll_runs')
    .select('id, organization_id, year, month, payroll_type, status')
    .eq('id', payrollRunId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (runError || !run) {
    return { success: false, error: 'Payroll run not found' }
  }

  if (run.status !== 'APPROVED') {
    return { success: false, error: 'Only approved payroll runs can be locked' }
  }

  const { data: approvalRequest } = await supabase
    .from('approval_requests')
    .select('id, status')
    .eq('organization_id', orgId)
    .eq('request_type', PAYROLL_APPROVAL_REQUEST_TYPE)
    .eq('entity_type', PAYROLL_APPROVAL_ENTITY_TYPE)
    .eq('entity_id', payrollRunId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (approvalRequest && approvalRequest.status !== 'approved') {
    return { success: false, error: 'Payroll approval must be completed before locking' }
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('name, settings')
    .eq('id', orgId)
    .single()

  if (orgError || !org) {
    return { success: false, error: 'Organization not found' }
  }

  const { data: entryRows, error: entriesError } = await supabase
    .from('payroll_entries')
    .select('id, employee_id, net_salary, allowance_breakdown, deductions_breakdown')
    .eq('payroll_run_id', payrollRunId)

  if (entriesError) {
    return { success: false, error: entriesError.message ?? 'Failed to load payroll entries' }
  }

  const entries = (entryRows ?? []) as RawPayrollEntry[]
  if (entries.length === 0) {
    return { success: false, error: 'Save payroll entries before locking' }
  }

  const employeeIds = entries.map((e) => e.employee_id)

  const { data: employeesData, error: empError } = await supabase
    .from('employees')
    .select('id, staff_id, contract_type, department_id, job_role_id')
    .eq('organization_id', orgId)
    .in('id', employeeIds)

  if (empError || !employeesData?.length) {
    return { success: false, error: 'Failed to load employees for payslips' }
  }

  const employees = employeesData as RawEmployee[]
  const departmentIds = [...new Set(employees.map((e) => e.department_id).filter(Boolean))] as string[]
  const jobRoleIds = [...new Set(employees.map((e) => e.job_role_id).filter(Boolean))] as string[]

  const [
    { data: biodataRows },
    { data: deptRows },
    { data: roleRows },
  ] = await Promise.all([
    supabase
      .from('employee_biodata')
      .select('employee_id, firstname, lastname')
      .eq('organization_id', orgId)
      .in('employee_id', employeeIds),
    departmentIds.length
      ? supabase.from('departments').select('id, name').eq('organization_id', orgId).in('id', departmentIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    jobRoleIds.length
      ? supabase.from('job_roles').select('id, title').eq('organization_id', orgId).in('id', jobRoleIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ])

  const bioByEmp = new Map<string, { firstname: string | null; lastname: string | null }>()
  for (const row of biodataRows ?? []) {
    bioByEmp.set(row.employee_id, {
      firstname: row.firstname,
      lastname: row.lastname,
    })
  }

  const deptById = new Map((deptRows ?? []).map((d) => [d.id, d.name]))
  const roleById = new Map((roleRows ?? []).map((r) => [r.id, r.title]))
  const empById = new Map(employees.map((e) => [e.id, e]))

  const payslipInserts = entries.map((entry) => ({
    organization_id: orgId,
    payroll_run_id: payrollRunId,
    payroll_entry_id: entry.id,
    employee_id: entry.employee_id,
    status: 'PENDING' as const,
  }))

  const { error: payslipUpsertError } = await supabase.from('payslips').upsert(payslipInserts, {
    onConflict: 'payroll_run_id,employee_id',
    ignoreDuplicates: false,
  })

  if (payslipUpsertError) {
    console.error('[lockPayrollRun] payslips upsert:', payslipUpsertError)
    return { success: false, error: payslipUpsertError.message ?? 'Failed to create payslip records' }
  }

  const now = new Date().toISOString()

  const { error: lockError } = await supabase
    .from('payroll_runs')
    .update({
      status: 'LOCKED',
      locked_by: userId,
      locked_at: now,
    })
    .eq('id', payrollRunId)
    .eq('organization_id', orgId)
    .eq('status', 'APPROVED')

  if (lockError) {
    console.error('[lockPayrollRun] payroll_runs update:', lockError)
    return { success: false, error: lockError.message ?? 'Failed to lock payroll run' }
  }

  const { data: existingPayslips } = await supabase
    .from('payslips')
    .select('employee_id, status')
    .eq('payroll_run_id', payrollRunId)

  const generatedEmployeeIds = new Set(
    (existingPayslips ?? [])
      .filter((p) => p.status === 'GENERATED')
      .map((p) => p.employee_id as string)
  )

  const admin = createAdminClient()
  const bucketReady = await ensureOrganizationsBucket(admin)
  if (!bucketReady.ok) {
    return { success: false, error: `Storage is not available: ${bucketReady.message}` }
  }

  const runMeta = {
    year: run.year as number,
    month: run.month as number,
  }
  const payrollType = run.payroll_type as PayrollRunType

  type WorkItem = {
    entry: RawPayrollEntry
    entryInput: PayslipEntryInput
  }

  const workItems: WorkItem[] = []

  for (const entry of entries) {
    if (generatedEmployeeIds.has(entry.employee_id)) continue

    const emp = empById.get(entry.employee_id)
    if (!emp) continue

    const bio = bioByEmp.get(entry.employee_id)

    workItems.push({
      entry,
      entryInput: {
        staffId: emp.staff_id ?? '—',
        firstName: bio?.firstname ?? '',
        lastName: bio?.lastname ?? '',
        department: emp.department_id ? (deptById.get(emp.department_id) ?? '—') : '—',
        position: emp.job_role_id ? (roleById.get(emp.job_role_id) ?? '—') : '—',
        contractType: emp.contract_type,
        allowanceBreakdown: parseBreakdown<AllowanceBreakdownItem>(entry.allowance_breakdown),
        deductionsBreakdown: parseBreakdown<PayrollDeductionBreakdownItem>(
          entry.deductions_breakdown
        ),
        netSalary:
          typeof entry.net_salary === 'number'
            ? entry.net_salary
            : Number(String(entry.net_salary).replace(/,/g, '')) || 0,
      },
    })
  }

  let generated = generatedEmployeeIds.size
  let failed = 0

  const markPayslipFailed = async (employeeId: string, message: string) => {
    await supabase
      .from('payslips')
      .update({
        status: 'FAILED',
        error_message: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('payroll_run_id', payrollRunId)
      .eq('employee_id', employeeId)
  }

  const markPayslipGenerated = async (
    employeeId: string,
    objectPath: string,
    fileUrl: string
  ) => {
    await supabase
      .from('payslips')
      .update({
        status: 'GENERATED',
        storage_object_path: objectPath,
        file_url: fileUrl,
        generated_at: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('payroll_run_id', payrollRunId)
      .eq('employee_id', employeeId)
  }

  const processOne = async (item: WorkItem) => {
    const { entry, entryInput } = item
    try {
      const viewModel = mapEntryToPayslipViewModel(entryInput, runMeta, {
        name: org.name,
        settings: org.settings,
      })
      const pdfBuffer = await renderPayslipPdfBuffer(viewModel)
      const objectPath = buildPayslipObjectPath({
        organizationId: orgId,
        year: runMeta.year,
        month: runMeta.month,
        payrollType,
        payrollRunId,
        employeeId: entry.employee_id,
      })

      const uploadResult = await uploadPayslipPdf(admin, objectPath, pdfBuffer)
      if (!uploadResult.ok) {
        await markPayslipFailed(entry.employee_id, uploadResult.message)
        return { ok: false as const }
      }

      await markPayslipGenerated(entry.employee_id, uploadResult.objectPath, uploadResult.fileUrl)
      return { ok: true as const }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payslip generation failed'
      console.error('[lockPayrollRun] employee', entry.employee_id, err)
      await markPayslipFailed(entry.employee_id, message)
      return { ok: false as const }
    }
  }

  for (const batch of chunkArray(workItems, PAYSLIP_BATCH_SIZE)) {
    const results = await Promise.all(batch.map((item) => processOne(item)))
    for (const result of results) {
      if (result.ok) generated += 1
      else failed += 1
    }
  }

  revalidatePayrollRun(payrollRunId)

  const total = entries.length
  return { success: true, generated, failed, total }
}
