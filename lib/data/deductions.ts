'use server'

import { createClient } from '@/lib/supabase/server'
import type { SalaryComponentRow } from '@/lib/data/salary-components'

export type DeductionTableRow = SalaryComponentRow & {
  payroll_component_id: string | null
  payroll_value: number | null
  payroll_formula: string | null
}

type OpcNested = {
  id: string
  value: number | string | null
  formula: string | null
}

type SalaryComponentWithOpc = SalaryComponentRow & {
  organization_payroll_components: OpcNested[] | OpcNested | null
}

function firstOpc(
  nested: SalaryComponentWithOpc['organization_payroll_components']
): OpcNested | null {
  if (nested == null) return null
  if (Array.isArray(nested)) return nested[0] ?? null
  return nested
}

function toNumberOrNull(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export async function getDeductionsWithPayrollForCurrentOrg(): Promise<DeductionTableRow[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) return []

  const orgId = profile.organization_id

  const { data, error } = await supabase
    .from('salary_components')
    .select(
      `id, organization_id, name, code, type, calculation_type, calculation_base, based_on_component_id, formula, is_taxable, reduces_taxable_income, is_active, created_at,
       organization_payroll_components ( id, value, formula )`
    )
    .eq('organization_id', orgId)
    .eq('type', 'DEDUCTION')
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.error('[Deductions] Failed to fetch:', error)
    return []
  }

  return (data as SalaryComponentWithOpc[]).map((row) => {
    const opc = firstOpc(row.organization_payroll_components)
    return {
      id: row.id,
      organization_id: row.organization_id,
      name: row.name,
      code: row.code,
      type: row.type,
      calculation_type: row.calculation_type,
      calculation_base: row.calculation_base,
      based_on_component_id: row.based_on_component_id,
      formula: row.formula,
      is_taxable: row.is_taxable,
      reduces_taxable_income: row.reduces_taxable_income,
      is_active: row.is_active,
      created_at: row.created_at,
      payroll_component_id: opc?.id ?? null,
      payroll_value: toNumberOrNull(opc?.value ?? null),
      payroll_formula: opc?.formula ?? null,
    }
  })
}
