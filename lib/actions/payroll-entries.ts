'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getPayrollAdminContext } from '@/lib/actions/payroll-runs'
import {
  grossFromBreakdown,
  normalizeBreakdownWithBase,
  roundMoney,
} from '@/lib/payroll/gross-calculator'
import {
  computePayrollDeductions,
  type ConfiguredDeductionLine,
} from '@/lib/payroll/tax-calculator'
import { allowanceBreakdownSchema } from '@/lib/validations/payroll-entry'

const savePayrollEntrySchema = z.object({
  payrollRunId: z.string().uuid(),
  employeeId: z.string().uuid(),
  grossSalary: z.number(),
  allowanceBreakdown: allowanceBreakdownSchema,
})

const draftEntrySchema = z.object({
  employeeId: z.string().uuid(),
  grossSalary: z.number(),
  allowanceBreakdown: allowanceBreakdownSchema,
})

const savePayrollRunDraftSchema = z.object({
  payrollRunId: z.string().uuid(),
  entries: z.array(draftEntrySchema).min(1),
})

const GROSS_TOL = 0.02

export type SavePayrollEntryResult =
  | { success: true }
  | { success: false; error: string }

type PayrollEntriesSupabase = Awaited<
  ReturnType<typeof import('@/lib/supabase/server').createClient>
>

/** Recompute payroll_runs totals from all persisted entries for the run. */
async function syncPayrollRunTotalsFromEntries(
  supabase: PayrollEntriesSupabase,
  payrollRunId: string,
  orgId: string
): Promise<SavePayrollEntryResult> {
  const { data: entries, error: entriesError } = await supabase
    .from('payroll_entries')
    .select('gross_salary, net_salary')
    .eq('payroll_run_id', payrollRunId)

  if (entriesError) {
    console.error('[syncPayrollRunTotalsFromEntries]', entriesError)
    return { success: false, error: entriesError.message ?? 'Failed to load payroll entries' }
  }

  const rows = entries ?? []
  const totalGross = roundMoney(
    rows.reduce((s, r) => {
      const n = Number(r.gross_salary ?? 0)
      return s + (Number.isFinite(n) ? n : 0)
    }, 0)
  )
  const totalNet = roundMoney(
    rows.reduce((s, r) => {
      const n = Number(r.net_salary ?? 0)
      return s + (Number.isFinite(n) ? n : 0)
    }, 0)
  )
  const totalEmployees = rows.length

  const { error: runUpdateError } = await supabase
    .from('payroll_runs')
    .update({
      total_gross: totalGross,
      total_net: totalNet,
      total_employees: totalEmployees,
    })
    .eq('id', payrollRunId)
    .eq('organization_id', orgId)

  if (runUpdateError) {
    console.error('[syncPayrollRunTotalsFromEntries] payroll_runs update:', runUpdateError)
    return { success: false, error: runUpdateError.message ?? 'Failed to update payroll run totals' }
  }

  return { success: true }
}

/**
 * Update an existing payroll_entries row (update-only — never inserts).
 * Used by debounced per-employee auto-save when `has_payroll_entry` is true.
 */
export async function savePayrollEntryPreview(raw: unknown): Promise<SavePayrollEntryResult> {
  const ctx = await getPayrollAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const parsed = savePayrollEntrySchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid payload' }
  }

  const { payrollRunId, employeeId, grossSalary, allowanceBreakdown } = parsed.data
  const { supabase, orgId } = ctx

  const { data: run, error: runError } = await supabase
    .from('payroll_runs')
    .select('id, pay_group_id')
    .eq('id', payrollRunId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (runError || !run) {
    return { success: false, error: 'Payroll run not found' }
  }

  const { data: emp, error: empError } = await supabase
    .from('employees')
    .select('id, organization_id, pay_group, base_salary')
    .eq('id', employeeId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (empError || !emp) {
    return { success: false, error: 'Employee not found' }
  }

  if (emp.pay_group !== run.pay_group_id) {
    return { success: false, error: 'Employee is not in this payroll run pay group' }
  }

  // Guard: only update an existing row — never insert.
  const { count, error: existsError } = await supabase
    .from('payroll_entries')
    .select('id', { count: 'exact', head: true })
    .eq('payroll_run_id', payrollRunId)
    .eq('employee_id', employeeId)

  if (existsError || !count) {
    return { success: false, error: 'No existing payroll entry to update. Save draft first.' }
  }

  const base = (() => {
    const v = emp.base_salary
    if (v == null) return 0
    const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''))
    return Number.isFinite(n) ? n : 0
  })()

  const normalizedBreakdown = normalizeBreakdownWithBase(base, allowanceBreakdown)
  const expected = grossFromBreakdown(normalizedBreakdown)
  if (Math.abs(roundMoney(grossSalary) - expected) > GROSS_TOL) {
    return {
      success: false,
      error: 'Gross salary must equal the sum of breakdown line amounts.',
    }
  }

  const gross = roundMoney(grossSalary)

  // Fetch org deductions and recompute tax/net before persisting.
  type OpcRowSingle = { id: string; value: number | string | null; formula: string | null }
  type DeductionRowSingle = {
    id: string; name: string; code: string | null; calculation_type: string | null
    calculation_base: string | null; execution_phase: string | null; formula: string | null
    organization_payroll_components: OpcRowSingle[] | OpcRowSingle | null
  }
  const { data: deductionData } = await supabase
    .from('salary_components')
    .select('id, name, code, calculation_type, calculation_base, execution_phase, formula, organization_payroll_components!inner(id, value, formula)')
    .eq('organization_id', orgId)
    .eq('type', 'DEDUCTION')
    .eq('is_active', true)

  const configuredDeductions: ConfiguredDeductionLine[] = (deductionData as DeductionRowSingle[] ?? []).map((row) => {
    const opc: OpcRowSingle | null = Array.isArray(row.organization_payroll_components)
      ? (row.organization_payroll_components[0] ?? null)
      : (row.organization_payroll_components ?? null)
    const rawValue = opc?.value ?? null
    const value = rawValue == null ? null : typeof rawValue === 'number' ? rawValue : Number(rawValue)
    return {
      salary_component_id: row.id,
      name: row.name?.trim() || row.code || 'Deduction',
      code: row.code ?? null,
      calculation_type: row.calculation_type ?? null,
      calculation_base: row.calculation_base ?? null,
      execution_phase: row.execution_phase ?? null,
      value: Number.isFinite(value) ? value : null,
      formula: row.formula ?? null,
    }
  })

  const deductions = computePayrollDeductions({ gross, baseSalary: base, configuredDeductions })

  const { error: updateError } = await supabase
    .from('payroll_entries')
    .update({
      base_salary: roundMoney(base),
      gross_salary: gross,
      total_earnings: gross,
      total_deductions: deductions.totalDeductions,
      net_salary: deductions.net,
      allowance_breakdown: normalizedBreakdown,
      deductions_breakdown: deductions.breakdown,
    })
    .eq('payroll_run_id', payrollRunId)
    .eq('employee_id', employeeId)

  if (updateError) {
    console.error('[savePayrollEntryPreview]', updateError)
    return { success: false, error: updateError.message ?? 'Failed to save' }
  }

  const syncResult = await syncPayrollRunTotalsFromEntries(supabase, payrollRunId, orgId)
  if (!syncResult.success) return syncResult

  revalidatePath('/dashboard/admin/payroll')
  revalidatePath(`/dashboard/admin/payroll/${payrollRunId}`)
  return { success: true }
}

/**
 * Bulk-upsert all employee entries for a payroll run (used by Save Draft).
 * Inserts rows that do not yet exist and updates rows that do.
 */
export async function savePayrollRunDraft(raw: unknown): Promise<SavePayrollEntryResult> {
  const ctx = await getPayrollAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const parsed = savePayrollRunDraftSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid payload' }
  }

  const { payrollRunId, entries } = parsed.data
  const { supabase, orgId } = ctx

  const { data: run, error: runError } = await supabase
    .from('payroll_runs')
    .select('id, pay_group_id')
    .eq('id', payrollRunId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (runError || !run) {
    return { success: false, error: 'Payroll run not found' }
  }

  const employeeIds = entries.map((e) => e.employeeId)

  const { data: emps, error: empsError } = await supabase
    .from('employees')
    .select('id, pay_group, base_salary')
    .eq('organization_id', orgId)
    .in('id', employeeIds)

  if (empsError || !emps?.length) {
    return { success: false, error: 'Failed to load employees' }
  }

  const empMap = new Map(emps.map((e) => [e.id, e]))

  // Fetch org deduction components once for the whole batch.
  type OpcRow = { id: string; value: number | string | null; formula: string | null }
  type DeductionRow = {
    id: string; name: string; code: string | null; calculation_type: string | null
    calculation_base: string | null; execution_phase: string | null; formula: string | null
    is_active: boolean | null
    organization_payroll_components: OpcRow[] | OpcRow | null
  }
  const { data: deductionData } = await supabase
    .from('salary_components')
    .select('id, name, code, calculation_type, calculation_base, execution_phase, formula, is_active, organization_payroll_components!inner(id, value, formula)')
    .eq('organization_id', orgId)
    .eq('type', 'DEDUCTION')
    .eq('is_active', true)

  const configuredDeductions: ConfiguredDeductionLine[] = (deductionData as DeductionRow[] ?? []).map((row) => {
    const opc: OpcRow | null = Array.isArray(row.organization_payroll_components)
      ? (row.organization_payroll_components[0] ?? null)
      : (row.organization_payroll_components ?? null)
    const rawValue = opc?.value ?? null
    const value = rawValue == null ? null : typeof rawValue === 'number' ? rawValue : Number(rawValue)
    return {
      salary_component_id: row.id,
      name: row.name?.trim() || row.code || 'Deduction',
      code: row.code ?? null,
      calculation_type: row.calculation_type ?? null,
      calculation_base: row.calculation_base ?? null,
      execution_phase: row.execution_phase ?? null,
      value: Number.isFinite(value) ? value : null,
      formula: row.formula ?? null,
    }
  })

  const upsertRows = []
  for (const entry of entries) {
    const emp = empMap.get(entry.employeeId)
    if (!emp) return { success: false, error: `Employee ${entry.employeeId} not found` }
    if (emp.pay_group !== run.pay_group_id) {
      return { success: false, error: `Employee ${entry.employeeId} is not in this payroll run pay group` }
    }

    const base = (() => {
      const v = emp.base_salary
      if (v == null) return 0
      const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''))
      return Number.isFinite(n) ? n : 0
    })()

    const normalizedBreakdown = normalizeBreakdownWithBase(base, entry.allowanceBreakdown)
    const expected = grossFromBreakdown(normalizedBreakdown)
    if (Math.abs(roundMoney(entry.grossSalary) - expected) > GROSS_TOL) {
      return { success: false, error: `Gross mismatch for employee ${entry.employeeId}` }
    }

    const gross = roundMoney(entry.grossSalary)
    const deductions = computePayrollDeductions({ gross, baseSalary: base, configuredDeductions })

    upsertRows.push({
      payroll_run_id: payrollRunId,
      employee_id: entry.employeeId,
      base_salary: roundMoney(base),
      gross_salary: gross,
      total_earnings: gross,
      total_deductions: deductions.totalDeductions,
      net_salary: deductions.net,
      allowance_breakdown: normalizedBreakdown,
      deductions_breakdown: deductions.breakdown,
    })
  }

  const { error: upsertError } = await supabase
    .from('payroll_entries')
    .upsert(upsertRows, { onConflict: 'payroll_run_id,employee_id' })

  if (upsertError) {
    console.error('[savePayrollRunDraft]', upsertError)
    return { success: false, error: upsertError.message ?? 'Failed to save draft' }
  }

  const syncResult = await syncPayrollRunTotalsFromEntries(supabase, payrollRunId, orgId)
  if (!syncResult.success) return syncResult

  revalidatePath('/dashboard/admin/payroll')
  revalidatePath(`/dashboard/admin/payroll/${payrollRunId}`)
  return { success: true }
}
