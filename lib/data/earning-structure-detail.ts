import { createClient } from '@/lib/supabase/server'

export const PHASES = {
  BASE: 0,
  ALLOWANCE: 1,
  PRE_TAX_DEDUCTION: 2,
  TAX: 3,
  POST_TAX_DEDUCTION: 4,
} as const

type PriorityComponent = {
  type: 'ALLOWANCE' | 'DEDUCTION'
  code: string | null
  reduces_taxable_income: boolean | null
}

export function resolvePriority(component: PriorityComponent): number {
  if (component.type === 'ALLOWANCE') return PHASES.ALLOWANCE

  if (component.type === 'DEDUCTION') {
    if (component.code === 'PAYE') return PHASES.TAX
    if (component.reduces_taxable_income) return PHASES.PRE_TAX_DEDUCTION
    return PHASES.POST_TAX_DEDUCTION
  }

  return PHASES.ALLOWANCE
}

export type EarningStructureAllowanceRow = {
  assignment_id: string
  salary_structure_id: string
  salary_component_id: string
  allowance_name: string
  calculation_type: 'FIXED' | 'PERCENTAGE' | 'FORMULA' | null
  calculation_base: 'NONE' | 'BASIC' | 'GROSS' | 'TAXABLE' | 'CUSTOM' | null
  value: number | null
  formula: string | null
  priority: number
  created_at: string
}

export type EarningStructureDetailsPayload = {
  structure_id: string
  structure_name: string
  level_name: string
  allowances: EarningStructureAllowanceRow[]
  attachable_allowances: Array<{
    id: string
    name: string
    calculation_type: 'FIXED' | 'PERCENTAGE' | 'FORMULA' | null
    calculation_base: 'NONE' | 'BASIC' | 'GROSS' | 'TAXABLE' | 'CUSTOM' | null
  }>
}

export async function getEarningStructureDetailsForCurrentOrg(
  routeId: string
): Promise<EarningStructureDetailsPayload | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) return null

  const orgId = profile.organization_id

  const { data: structure, error: structureError } = await supabase
    .from('salary_structures')
    .select('id, name, organization_id')
    .eq('id', routeId)
    .eq('organization_id', orgId)
    .single()

  let resolvedStructure:
    | { id: string; name: string; organization_id: string }
    | null = structureError || !structure ? null : structure

  // Fallback: route id may be level_salary_structure mapping id.
  if (!resolvedStructure) {
    const { data: mapping, error: mappingError } = await supabase
      .from('level_salary_structure')
      .select('id, structure_id, salary_structures!inner(id, name, organization_id)')
      .eq('id', routeId)
      .eq('salary_structures.organization_id', orgId)
      .single()

    if (!mappingError && mapping) {
      const raw = mapping as {
        id: string
        structure_id: string
        salary_structures:
          | { id: string; name: string; organization_id: string }
          | Array<{ id: string; name: string; organization_id: string }>
          | null
      }
      const salaryStructure = Array.isArray(raw.salary_structures)
        ? raw.salary_structures[0]
        : raw.salary_structures

      if (salaryStructure) {
        resolvedStructure = salaryStructure
      }
    }
  }

  if (!resolvedStructure) return null

  const { data: levelMapping } = await supabase
    .from('level_salary_structure')
    .select('level_id, employee_levels(name)')
    .eq('structure_id', resolvedStructure.id)
    .maybeSingle()

  const levelName = (() => {
    if (!levelMapping?.level_id) return 'Default'
    const raw = levelMapping.employee_levels as { name: string } | { name: string }[] | null
    if (!raw) return 'Unknown level'
    return Array.isArray(raw) ? (raw[0]?.name ?? 'Unknown level') : raw.name
  })()

  // All allowance links on this structure (including inactive components) — used so Add cannot duplicate a hidden row.
  const { data: allAllowanceLinkData, error: allAllowanceLinksError } = await supabase
    .from('salary_structure_components')
    .select('salary_component_id, salary_components!inner(type)')
    .eq('salary_structure_id', resolvedStructure.id)
    .eq('salary_components.type', 'ALLOWANCE')

  if (allAllowanceLinksError) {
    console.error('[EarningStructureDetail] Failed to fetch structure allowance links:', allAllowanceLinksError)
  }

  const assignedAllowanceIds = new Set(
    ((allAllowanceLinkData ?? []) as Array<{ salary_component_id: string }>).map((r) => r.salary_component_id)
  )

  const { data: assignmentsData, error: assignmentsError } = await supabase
    .from('salary_structure_components')
    .select(
      'id, salary_structure_id, salary_component_id, value, formula, priority, created_at, salary_components!inner(id, name, code, type, calculation_type, calculation_base, reduces_taxable_income, is_active)'
    )
    .eq('salary_structure_id', resolvedStructure.id)
    .eq('salary_components.type', 'ALLOWANCE')
    .eq('salary_components.is_active', true)

  if (assignmentsError) {
    console.error('[EarningStructureDetail] Failed to fetch allowance assignments:', assignmentsError)
    return {
      structure_id: resolvedStructure.id,
      structure_name: resolvedStructure.name,
      level_name: levelName,
      allowances: [],
      attachable_allowances: [],
    }
  }

  const allowances = ((assignmentsData ?? []) as Array<{
    id: string
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
          type: 'ALLOWANCE' | 'DEDUCTION' | null
          calculation_type: 'FIXED' | 'PERCENTAGE' | 'FORMULA' | null
          calculation_base: 'NONE' | 'BASIC' | 'GROSS' | 'TAXABLE' | 'CUSTOM' | null
          reduces_taxable_income: boolean | null
          is_active: boolean | null
        }
      | Array<{
          id: string
          name: string | null
          code: string | null
          type: 'ALLOWANCE' | 'DEDUCTION' | null
          calculation_type: 'FIXED' | 'PERCENTAGE' | 'FORMULA' | null
          calculation_base: 'NONE' | 'BASIC' | 'GROSS' | 'TAXABLE' | 'CUSTOM' | null
          reduces_taxable_income: boolean | null
          is_active: boolean | null
        }>
      | null
  }>).map((item) => {
    const component = Array.isArray(item.salary_components)
      ? item.salary_components[0]
      : item.salary_components

    if (!component) {
      return {
        assignment_id: item.id,
        salary_structure_id: item.salary_structure_id,
        salary_component_id: item.salary_component_id,
        allowance_name: 'Unnamed allowance',
        calculation_type: null,
        calculation_base: null,
        value: item.value,
        formula: item.formula,
        priority: PHASES.ALLOWANCE,
        created_at: item.created_at,
      }
    }

    const fallbackPriority = resolvePriority({
      type: component.type === 'DEDUCTION' ? 'DEDUCTION' : 'ALLOWANCE',
      code: component.code,
      reduces_taxable_income: component.reduces_taxable_income,
    })

    return {
      assignment_id: item.id,
      salary_structure_id: item.salary_structure_id,
      salary_component_id: item.salary_component_id,
      allowance_name: component.name ?? 'Unnamed allowance',
      calculation_type: component.calculation_type,
      calculation_base: component.calculation_base,
      value: item.value,
      formula: item.formula,
      priority: item.priority ?? fallbackPriority,
      created_at: item.created_at,
    }
  })

  allowances.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  const assignedAllowanceIdsForAttach = allAllowanceLinksError
    ? new Set(allowances.map((row) => row.salary_component_id))
    : assignedAllowanceIds

  const { data: allowancePoolData, error: allowancePoolError } = await supabase
    .from('salary_components')
    .select('id, name, calculation_type, calculation_base')
    .eq('organization_id', orgId)
    .eq('type', 'ALLOWANCE')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (allowancePoolError) {
    console.error('[EarningStructureDetail] Failed to fetch allowance pool:', allowancePoolError)
  }

  const attachableAllowances = ((allowancePoolData ?? []) as Array<{
    id: string
    name: string | null
    calculation_type: 'FIXED' | 'PERCENTAGE' | 'FORMULA' | null
    calculation_base: 'NONE' | 'BASIC' | 'GROSS' | 'TAXABLE' | 'CUSTOM' | null
  }>)
    .filter((item) => !assignedAllowanceIdsForAttach.has(item.id))
    .map((item) => ({
      id: item.id,
      name: item.name ?? 'Unnamed allowance',
      calculation_type: item.calculation_type,
      calculation_base: item.calculation_base,
    }))

  return {
    structure_id: resolvedStructure.id,
    structure_name: resolvedStructure.name,
    level_name: levelName,
    allowances,
    attachable_allowances: attachableAllowances,
  }
}
