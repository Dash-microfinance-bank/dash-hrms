'use server'

import { createClient } from '@/lib/supabase/server'
import {
  BASIC_BREAKDOWN_TYPE,
  grossCalculator,
  grossFromBreakdown,
  normalizeBreakdownWithBase,
  type AllowanceBreakdownItem,
  type TaxableAllowanceLine,
} from '@/lib/payroll/gross-calculator'
import { allowanceBreakdownSchema } from '@/lib/validations/payroll-entry'
import {
  computePayrollDeductions,
  type ConfiguredDeductionLine,
  type PayrollDeductionBreakdownItem,
} from '@/lib/payroll/tax-calculator'
import type { PayDayType, PayFrequency } from '@/lib/data/pay-groups'
import type { PayrollRunStatus, PayrollRunType } from '@/lib/data/payroll-runs'
import { getPayrollApprovalState, type PayrollApprovalState } from '@/lib/data/payroll-approvals'
import { formatPayDateLabel, formatPayPeriodLabel } from '@/lib/payroll/pay-run-labels'

/** Legacy display row (tax/net still optional). */
export type PayrollRunEmployeePreviewRow = {
  id: string
  staff_id: string
  first_name: string
  last_name: string
  pay_grade: string
  department: string
  job_role: string
  gross: number | null
  tax: number | null
  net: number | null
}

/** Full row for payroll preview with compensation + persisted breakdown. */
export type PayrollRunPreviewCompensationRow = Omit<PayrollRunEmployeePreviewRow, 'gross' | 'tax' | 'net'> & {
  base_salary: number
  allowance_breakdown: AllowanceBreakdownItem[]
  /** Always equals `base_salary + sum(allowance_breakdown.amount)` after rounding. */
  gross: number
  gross_source: 'payroll_entry' | 'calculated'
  /** True when a payroll_entries row already exists in the DB for this run+employee. */
  has_payroll_entry: boolean
  deductions_breakdown: PayrollDeductionBreakdownItem[]
  taxable_income: number
  tax: number
  total_deductions: number
  net: number
}

export type PayrollRunPreviewMeta = {
  status: PayrollRunStatus
  payroll_type: PayrollRunType
  pay_group_name: string | null
  pay_period_label: string
  pay_date_label: string
  total_gross: number
  total_net: number
  total_employees: number
}

export type PayrollRunPreviewData = {
  rows: PayrollRunPreviewCompensationRow[]
  run: PayrollRunPreviewMeta | null
  /** True when at least one payroll_entries row exists for this payroll run. */
  runHasPersistedEntries: boolean
  /** Org deduction components to pass to the client for live recomputation. */
  configuredDeductions: ConfiguredDeductionLine[]
  payrollRunStatus: PayrollRunStatus | null
  approval: PayrollApprovalState
}

type RawPayrollRunWithGroup = {
  id: string
  pay_group_id: string
  status: PayrollRunStatus
  payroll_type: PayrollRunType
  year: number
  month: number
  period: number | null
  total_gross: number | string | null
  total_net: number | string | null
  total_employees: number | null
  pay_group: {
    name: string | null
    pay_frequency: PayFrequency | null
    pay_day_type: PayDayType | null
    pay_day: number | null
    anchor_date: string | null
  } | null
}

function emptyPreviewData(): PayrollRunPreviewData {
  return {
    rows: [],
    run: null,
    runHasPersistedEntries: false,
    configuredDeductions: [],
    payrollRunStatus: null,
    approval: {
      requestId: null,
      requestStatus: null,
      hasOpenRequest: false,
      canSubmit: false,
      canReviewCurrentStep: false,
      currentStepId: null,
      currentStepOrder: null,
      steps: [],
    },
  }
}

function parseRunMoney(v: number | string | null | undefined): number {
  if (v == null) return 0
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function buildPayrollRunPreviewMeta(run: RawPayrollRunWithGroup): PayrollRunPreviewMeta {
  const pg = run.pay_group
  return {
    status: run.status,
    payroll_type: run.payroll_type,
    pay_group_name: pg?.name ?? null,
    pay_period_label: formatPayPeriodLabel({
      year: run.year,
      month: run.month,
      period: run.period,
      pay_frequency: pg?.pay_frequency ?? null,
    }),
    pay_date_label: formatPayDateLabel(
      {
        pay_day_type: pg?.pay_day_type ?? null,
        pay_day: pg?.pay_day ?? null,
        pay_frequency: pg?.pay_frequency ?? null,
        anchor_date: pg?.anchor_date ?? null,
      },
      run.year,
      run.month
    ),
    total_gross: parseRunMoney(run.total_gross),
    total_net: parseRunMoney(run.total_net),
    total_employees: run.total_employees ?? 0,
  }
}

type RawEmployee = {
  id: string
  staff_id: string
  department_id: string
  job_role_id: string
  pay_grade: string | null
  base_salary: string | number | null
  level: string | null
}

type PayrollEntryRow = {
  employee_id: string
  gross_salary: string | number | null
  allowance_breakdown: unknown
}

function parseBaseSalary(v: string | number | null | undefined): number {
  if (v == null) return 0
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function parseStoredBreakdown(raw: unknown): AllowanceBreakdownItem[] {
  if (raw == null) return []
  if (typeof raw === 'string') {
    try {
      return parseStoredBreakdown(JSON.parse(raw))
    } catch {
      return []
    }
  }
  if (!Array.isArray(raw)) return []
  const parsed = allowanceBreakdownSchema.safeParse(raw)
  return parsed.success ? parsed.data : []
}

function unwrapRelation<T>(rel: T | T[] | null | undefined): T | null {
  if (rel == null) return null
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

type LevelStructureMapRow = {
  level_id: string | null
  structure_id: string
  created_at: string
  salary_structures:
    | { id: string; organization_id: string; created_at: string }
    | Array<{ id: string; organization_id: string; created_at: string }>
    | null
}

function pickStructureIdFromMappings(rows: LevelStructureMapRow[]): string | undefined {
  if (!rows.length) return undefined
  const sorted = [...rows].sort((a, b) => {
    const sa = unwrapRelation(a.salary_structures)
    const sb = unwrapRelation(b.salary_structures)
    return (sb?.created_at ?? '').localeCompare(sa?.created_at ?? '')
  })
  return sorted[0]?.structure_id
}

function buildStructureByLevel(rows: LevelStructureMapRow[]): Map<string, string> {
  const structureByLevel = new Map<string, string>()
  const grouped = new Map<string, LevelStructureMapRow[]>()
  for (const m of rows) {
    if (m.level_id == null) continue
    const arr = grouped.get(m.level_id) ?? []
    arr.push(m)
    grouped.set(m.level_id, arr)
  }
  for (const [lid, arr] of grouped) {
    const structureId = pickStructureIdFromMappings(arr)
    if (structureId) structureByLevel.set(lid, structureId)
  }
  return structureByLevel
}

function resolveStructureIdForEmployee(
  level: string | null,
  structureByLevel: Map<string, string>,
  defaultStructureId: string | undefined
): string | undefined {
  if (level) {
    const mapped = structureByLevel.get(level)
    if (mapped) return mapped
  }
  return defaultStructureId
}

/** Sort allowance lines by priority then created_at (stable). */
function sortStructureLines(
  rows: Array<{
    salary_structure_id: string
    salary_component_id: string
    priority: number | null
    created_at: string
  }>,
  structureId: string,
  lines: TaxableAllowanceLine[]
): TaxableAllowanceLine[] {
  const meta = new Map<string, { priority: number; created_at: string }>()
  for (const r of rows) {
    if (r.salary_structure_id !== structureId) continue
    meta.set(r.salary_component_id, {
      priority: r.priority ?? 9999,
      created_at: r.created_at,
    })
  }
  return [...lines].sort((a, b) => {
    const ma = meta.get(a.salary_component_id) ?? { priority: 9999, created_at: '' }
    const mb = meta.get(b.salary_component_id) ?? { priority: 9999, created_at: '' }
    if (ma.priority !== mb.priority) return ma.priority - mb.priority
    return ma.created_at.localeCompare(mb.created_at)
  })
}

/**
 * Active employees in the payroll run’s pay group with gross + taxable allowance breakdown.
 */
export async function getPayrollRunPreviewData(
  payrollRunId: string
): Promise<PayrollRunPreviewData> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return emptyPreviewData()

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) return emptyPreviewData()

  const orgId = profile.organization_id

  const { data: runRow, error: runError } = await supabase
    .from('payroll_runs')
    .select(
      'id, pay_group_id, status, payroll_type, year, month, period, total_gross, total_net, total_employees, pay_group:pay_groups(name, pay_frequency, pay_day_type, pay_day, anchor_date)'
    )
    .eq('id', payrollRunId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (runError || !runRow?.pay_group_id) {
    if (runError) {
      console.error('[PayrollRunPreview] Failed to load payroll run:', runError)
    }
    return emptyPreviewData()
  }

  const run = runRow as unknown as RawPayrollRunWithGroup
  const runMeta = buildPayrollRunPreviewMeta(run)
  const payrollRunStatus = runMeta.status
  const payGroupId = run.pay_group_id

  const { data: employeesData, error: empError } = await supabase
    .from('employees')
    .select('id, staff_id, department_id, job_role_id, pay_grade, base_salary, level')
    .eq('organization_id', orgId)
    .eq('pay_group', payGroupId)
    .eq('active', true)
    .not('auth_id', 'is', null)
    .order('staff_id', { ascending: true })

  if (empError || !employeesData?.length) {
    if (empError) {
      console.error('[PayrollRunPreview] Failed to load employees:', empError)
    }
    const approval = await getPayrollApprovalState(payrollRunId, {
      runHasPersistedEntries: false,
      payrollRunStatus,
    })
    return {
      rows: [],
      run: runMeta,
      runHasPersistedEntries: false,
      configuredDeductions: [],
      payrollRunStatus,
      approval,
    }
  }

  const employees = employeesData as RawEmployee[]
  const employeeIds = employees.map((e) => e.id)
  const departmentIds = [...new Set(employees.map((e) => e.department_id))]
  const jobRoleIds = [...new Set(employees.map((e) => e.job_role_id))]
  const gradeIds = [...new Set(employees.map((e) => e.pay_grade).filter((g): g is string => !!g))]
  const levelIds = [...new Set(employees.map((e) => e.level).filter((l): l is string => !!l))]

  const [
    { data: biodataRows, error: bioError },
    { data: deptRows, error: deptError },
    { data: roleRows, error: roleError },
    { data: gradeRows, error: gradeError },
    { data: entryRows, error: entryError },
    { data: levelMapRows, error: levelMapError },
    { data: defaultMapRows, error: defaultMapError },
    { data: deductionRows, error: deductionError },
  ] = await Promise.all([
    supabase
      .from('employee_biodata')
      .select('employee_id, firstname, lastname')
      .eq('organization_id', orgId)
      .in('employee_id', employeeIds),
    departmentIds.length
      ? supabase.from('departments').select('id, name').eq('organization_id', orgId).in('id', departmentIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    jobRoleIds.length
      ? supabase.from('job_roles').select('id, title').eq('organization_id', orgId).in('id', jobRoleIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[], error: null }),
    gradeIds.length
      ? supabase.from('grades').select('id, name').eq('organization_id', orgId).in('id', gradeIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    supabase
      .from('payroll_entries')
      .select('employee_id, gross_salary, allowance_breakdown')
      .eq('payroll_run_id', payrollRunId)
      .in('employee_id', employeeIds),
    levelIds.length
      ? supabase
          .from('level_salary_structure')
          .select(
            'level_id, structure_id, created_at, salary_structures!inner(id, organization_id, created_at)'
          )
          .in('level_id', levelIds)
          .eq('salary_structures.organization_id', orgId)
      : Promise.resolve({ data: [] as LevelStructureMapRow[], error: null }),
    supabase
      .from('level_salary_structure')
      .select(
        'level_id, structure_id, created_at, salary_structures!inner(id, organization_id, created_at)'
      )
      .is('level_id', null)
      .eq('salary_structures.organization_id', orgId),
    supabase
      .from('salary_components')
      .select(
        'id, name, code, calculation_type, calculation_base, execution_phase, formula, is_active, organization_payroll_components!inner(id, value, formula)'
      )
      .eq('organization_id', orgId)
      .eq('type', 'DEDUCTION')
      .eq('is_active', true),
  ])

  if (bioError) console.error('[PayrollRunPreview] Biodata:', bioError)
  if (deptError) console.error('[PayrollRunPreview] Departments:', deptError)
  if (roleError) console.error('[PayrollRunPreview] Job roles:', roleError)
  if (gradeError) console.error('[PayrollRunPreview] Grades:', gradeError)
  if (entryError) console.error('[PayrollRunPreview] payroll_entries:', entryError)
  if (levelMapError) console.error('[PayrollRunPreview] level_salary_structure:', levelMapError)
  if (defaultMapError) console.error('[PayrollRunPreview] default level_salary_structure:', defaultMapError)
  if (deductionError) console.error('[PayrollRunPreview] deduction components:', deductionError)

  const bioByEmp = new Map<string, { firstname: string | null; lastname: string | null }>()
  for (const row of biodataRows ?? []) {
    bioByEmp.set(row.employee_id, {
      firstname: row.firstname,
      lastname: row.lastname,
    })
  }

  const deptById = new Map<string, string>()
  for (const d of deptRows ?? []) {
    deptById.set(d.id, d.name)
  }

  const roleById = new Map<string, string>()
  for (const r of roleRows ?? []) {
    roleById.set(r.id, r.title)
  }

  const gradeById = new Map<string, string>()
  for (const g of gradeRows ?? []) {
    gradeById.set(g.id, g.name)
  }

  const entryByEmp = new Map<string, PayrollEntryRow>()
  for (const row of (entryRows ?? []) as PayrollEntryRow[]) {
    entryByEmp.set(row.employee_id, row)
  }

  const structureByLevel = buildStructureByLevel((levelMapRows ?? []) as LevelStructureMapRow[])
  const defaultStructureId = pickStructureIdFromMappings(
    (defaultMapRows ?? []) as LevelStructureMapRow[]
  )

  const structureIds = [
    ...new Set([
      ...structureByLevel.values(),
      ...(defaultStructureId ? [defaultStructureId] : []),
    ]),
  ]

  type ComponentQueryRow = {
    salary_structure_id: string
    salary_component_id: string
    value: number | null
    formula: string | null
    priority: number | null
    created_at: string
    salary_components:
      | {
          id: string
          name: string | null
          code: string | null
          type: string | null
          calculation_type: string | null
          calculation_base: string | null
          is_taxable: boolean | null
          is_active: boolean | null
        }
      | Array<{
          id: string
          name: string | null
          code: string | null
          type: string | null
          calculation_type: string | null
          calculation_base: string | null
          is_taxable: boolean | null
          is_active: boolean | null
        }>
      | null
  }

  let componentRows: ComponentQueryRow[] = []
  if (structureIds.length > 0) {
    const { data: compData, error: compError } = await supabase
      .from('salary_structure_components')
      .select(
        'salary_structure_id, salary_component_id, value, formula, priority, created_at, salary_components!inner(id, name, code, type, calculation_type, calculation_base, is_taxable, is_active)'
      )
      .in('salary_structure_id', structureIds)
      .eq('salary_components.type', 'ALLOWANCE')
      .eq('salary_components.is_taxable', true)
      .eq('salary_components.is_active', true)

    if (compError) {
      console.error('[PayrollRunPreview] salary_structure_components:', compError)
    } else {
      componentRows = (compData ?? []) as ComponentQueryRow[]
    }
  }

  const linesByStructure = new Map<string, TaxableAllowanceLine[]>()
  const rawMetaByStructure = new Map<string, ComponentQueryRow[]>()
  for (const row of componentRows) {
    const sc = unwrapRelation(row.salary_components)
    if (!sc || sc.is_taxable !== true || sc.is_active === false) continue
    const line: TaxableAllowanceLine = {
      salary_component_id: row.salary_component_id,
      name: sc.name?.trim() || sc.code?.trim() || 'Allowance',
      calculation_type: sc.calculation_type,
      calculation_base: sc.calculation_base,
      value: row.value,
      formula: row.formula,
      is_taxable: true,
    }
    const list = linesByStructure.get(row.salary_structure_id) ?? []
    list.push(line)
    linesByStructure.set(row.salary_structure_id, list)
    const metaList = rawMetaByStructure.get(row.salary_structure_id) ?? []
    metaList.push(row)
    rawMetaByStructure.set(row.salary_structure_id, metaList)
  }
  for (const [sid, lines] of linesByStructure) {
    const meta = rawMetaByStructure.get(sid) ?? []
    linesByStructure.set(sid, sortStructureLines(meta, sid, lines))
  }

  // Build configured deduction lines from the query result.
  // Each salary_component row with an `organization_payroll_components` join gives
  // us the org-specific value/formula override.
  const configuredDeductions: ConfiguredDeductionLine[] = (deductionRows ?? []).map((row) => {
    type OpcNested = { id: string; value: number | string | null; formula: string | null }
    const opc: OpcNested | null = Array.isArray(row.organization_payroll_components)
      ? (row.organization_payroll_components[0] ?? null)
      : (row.organization_payroll_components ?? null)
    const rawValue = opc?.value ?? null
    const value = rawValue == null ? null : typeof rawValue === 'number' ? rawValue : Number(rawValue)
    return {
      salary_component_id: row.id as string,
      name: (row.name as string)?.trim() || (row.code as string) || 'Deduction',
      code: (row.code as string | null) ?? null,
      calculation_type: (row.calculation_type as string | null) ?? null,
      calculation_base: (row.calculation_base as string | null) ?? null,
      execution_phase: (row.execution_phase as string | null) ?? null,
      value: Number.isFinite(value) ? (value as number) : null,
      formula: (row.formula as string | null) ?? null,
    }
  })

  const TOL = 0.02
  const runHasPersistedEntries = (entryRows ?? []).length > 0

  const rows = employees.map((emp) => {
    const bio = bioByEmp.get(emp.id)
    const gradeName = emp.pay_grade ? gradeById.get(emp.pay_grade) : undefined
    const base = parseBaseSalary(emp.base_salary)

    const entry = entryByEmp.get(emp.id)
    const parsedBreakdown = entry ? parseStoredBreakdown(entry.allowance_breakdown) : []
    const nonBasicStored = parsedBreakdown.filter((line) => line.type !== BASIC_BREAKDOWN_TYPE)

    let allowance_breakdown: AllowanceBreakdownItem[]
    let gross: number
    let gross_source: 'payroll_entry' | 'calculated'

    if (nonBasicStored.length > 0) {
      allowance_breakdown = normalizeBreakdownWithBase(base, parsedBreakdown)
      gross = grossFromBreakdown(allowance_breakdown)
      gross_source = 'payroll_entry'
      const storedGross = parseBaseSalary(entry?.gross_salary ?? null)
      if (entry && Math.abs(storedGross - gross) > TOL) {
        console.warn(
          '[PayrollRunPreview] payroll_entries.gross_salary out of sync with breakdown; using derived gross',
          { employee_id: emp.id, storedGross, derivedGross: gross }
        )
      }
    } else {
      const structureId = resolveStructureIdForEmployee(
        emp.level,
        structureByLevel,
        defaultStructureId
      )
      const templateLines = structureId ? linesByStructure.get(structureId) ?? [] : []

      if (!structureId) {
        console.warn('[PayrollRunPreview] No earning structure for employee', {
          employee_id: emp.id,
          level: emp.level,
        })
      }

      const calc = grossCalculator({ baseSalary: base, taxableAllowances: templateLines })
      allowance_breakdown = calc.allowanceBreakdown
      gross = calc.gross
      gross_source = 'calculated'
    }

    const deductions = computePayrollDeductions({ gross, baseSalary: base, configuredDeductions })

    return {
      id: emp.id,
      staff_id: emp.staff_id,
      first_name: (bio?.firstname ?? '').trim() || '—',
      last_name: (bio?.lastname ?? '').trim() || '—',
      pay_grade: gradeName?.trim() || '—',
      department: deptById.get(emp.department_id)?.trim() || '—',
      job_role: roleById.get(emp.job_role_id)?.trim() || '—',
      gross,
      base_salary: base,
      allowance_breakdown,
      gross_source,
      has_payroll_entry: entryByEmp.has(emp.id),
      deductions_breakdown: deductions.breakdown,
      taxable_income: deductions.taxableIncome,
      tax: deductions.tax,
      total_deductions: deductions.totalDeductions,
      net: deductions.net,
    }
  })

  const approval = await getPayrollApprovalState(payrollRunId, {
    runHasPersistedEntries,
    payrollRunStatus,
  })

  return {
    rows,
    run: runMeta,
    runHasPersistedEntries,
    configuredDeductions,
    payrollRunStatus,
    approval,
  }
}
