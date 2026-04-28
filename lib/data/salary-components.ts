'use server'

import { createClient } from '@/lib/supabase/server'

export type SalaryComponentCode = 'BASIC' | 'PENSION' | 'PAYE'
export type SalaryComponentType = 'ALLOWANCE' | 'DEDUCTION'
export type SalaryComponentCalculationType = 'FIXED' | 'PERCENTAGE' | 'FORMULA'
export type SalaryComponentCalculationBase = 'NONE' | 'BASIC' | 'GROSS' | 'TAXABLE' | 'CUSTOM'

export type SalaryComponentRow = {
  id: string
  organization_id: string
  name: string | null
  code: SalaryComponentCode | null
  type: SalaryComponentType | null
  calculation_type: SalaryComponentCalculationType | null
  calculation_base: SalaryComponentCalculationBase | null
  based_on_component_id: string | null
  formula: string | null
  is_taxable: boolean | null
  reduces_taxable_income: boolean | null
  is_active: boolean | null
  created_at: string
}

export async function getSalaryComponentsForCurrentOrg(
  componentType: SalaryComponentType
): Promise<SalaryComponentRow[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!myProfile?.organization_id) return []

  const { data, error } = await supabase
    .from('salary_components')
    .select(
      'id, organization_id, name, code, type, calculation_type, calculation_base, based_on_component_id, formula, is_taxable, reduces_taxable_income, is_active, created_at'
    )
    .eq('organization_id', myProfile.organization_id)
    .eq('type', componentType)
    // .order('priority', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.error('[SalaryComponents] Failed to fetch components:', error)
    return []
  }

  return data as SalaryComponentRow[]
}
