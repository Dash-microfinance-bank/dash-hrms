'use server'

import { createClient } from '@/lib/supabase/server'

export type EarningStructureSummaryRow = {
  mapping_id: string
  structure_id: string
  structure_name: string
  level_id: string | null
  level_name: string
  allowances_count: number
  employees_count: number
  status: 'active' | 'disabled'
  created_at: string
}

export type EarningStructureLevelOption = {
  id: string | null
  name: string
}

export async function getEarningStructureSummaryForCurrentOrg(): Promise<{
  rows: EarningStructureSummaryRow[]
  levels: EarningStructureLevelOption[]
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { rows: [], levels: [] }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) return { rows: [], levels: [] }

  const orgId = profile.organization_id

  const { data: levelsData, error: levelsError } = await supabase
    .from('employee_levels')
    .select('id, name')
    .eq('organization_id', orgId)
    .order('name', { ascending: true })
  if (levelsError) {
    console.error('[EarningStructureSummary] Failed to fetch employee levels:', levelsError)
    return { rows: [], levels: [] }
  }

  const levelNameById = new Map(
    ((levelsData ?? []) as Array<{ id: string; name: string }>).map((l) => [l.id, l.name])
  )

  const { data: mappingsData, error: mappingsError } = await supabase
    .from('level_salary_structure')
    .select(
      'id, level_id, structure_id, salary_structures!inner(id, name, created_at, organization_id)'
    )
    .eq('salary_structures.organization_id', orgId)

  if (mappingsError) {
    console.error('[EarningStructureSummary] Failed to fetch structure mappings:', mappingsError)
    return { rows: [], levels: [] }
  }

  const mappings = ((mappingsData ?? []) as Array<{
      id: string
      level_id: string | null
      structure_id: string
      salary_structures:
        | { id: string; name: string; created_at: string; organization_id: string }
        | Array<{ id: string; name: string; created_at: string; organization_id: string }>
        | null
    }>)
    .map((mapping) => {
      const structure = Array.isArray(mapping.salary_structures)
        ? mapping.salary_structures[0]
        : mapping.salary_structures

      if (!structure) return null

      return {
        id: mapping.id,
        level_id: mapping.level_id,
        structure_id: mapping.structure_id,
        salary_structures: structure,
      }
    })
    .filter(
      (
        mapping
      ): mapping is {
        id: string
        level_id: string | null
        structure_id: string
        salary_structures: { id: string; name: string; created_at: string; organization_id: string }
      } => mapping !== null
    )

  if (mappings.length === 0) {
    return {
      rows: [],
      levels: [{ id: null, name: 'Default' }, ...Array.from(levelNameById).map(([id, name]) => ({ id, name }))],
    }
  }

  const structureIds = [...new Set(mappings.map((m) => m.structure_id))]

  const { data: structureComponentsData, error: structureComponentsError } = await supabase
    .from('salary_structure_components')
    .select(
      'salary_structure_id, salary_component_id, salary_components!inner(id, type, is_active)'
    )
    .in('salary_structure_id', structureIds)
    .eq('salary_components.type', 'ALLOWANCE')

  if (structureComponentsError) {
    console.error('[EarningStructureSummary] Failed to fetch structure components:', structureComponentsError)
    return { rows: [], levels: [] }
  }

  const components = ((structureComponentsData ?? []) as Array<{
      salary_structure_id: string
      salary_component_id: string
      salary_components:
        | { id: string; type: 'ALLOWANCE' | 'DEDUCTION' | null; is_active: boolean | null }
        | Array<{ id: string; type: 'ALLOWANCE' | 'DEDUCTION' | null; is_active: boolean | null }>
        | null
    }>)
    .map((component) => {
      const salaryComponent = Array.isArray(component.salary_components)
        ? component.salary_components[0]
        : component.salary_components

      return {
        ...component,
        salary_components: salaryComponent,
      }
    })

  const allowanceStatsByStructure = new Map<
    string,
    {
      allowanceIds: Set<string>
      activeAllowanceIds: Set<string>
      hasActiveAllowance: boolean
      hasAllowance: boolean
    }
  >()

  for (const component of components) {
    if (!allowanceStatsByStructure.has(component.salary_structure_id)) {
      allowanceStatsByStructure.set(component.salary_structure_id, {
        allowanceIds: new Set<string>(),
        activeAllowanceIds: new Set<string>(),
        hasActiveAllowance: false,
        hasAllowance: false,
      })
    }
    const stats = allowanceStatsByStructure.get(component.salary_structure_id)!
    stats.hasAllowance = true
    stats.allowanceIds.add(component.salary_component_id)
    if (component.salary_components?.is_active !== false) {
      stats.hasActiveAllowance = true
      stats.activeAllowanceIds.add(component.salary_component_id)
    }
  }

  const { data: employeesData, error: employeesError } = await supabase
    .from('employees')
    .select('level')
    .eq('organization_id', orgId)

  if (employeesError) {
    console.error('[EarningStructureSummary] Failed to fetch employee counts:', employeesError)
    return { rows: [], levels: [] }
  }

  const employeeCountByLevelId = new Map<string | null, number>()
  for (const employee of (employeesData ?? []) as Array<{ level: string | null }>) {
    const key = employee.level ?? null
    employeeCountByLevelId.set(key, (employeeCountByLevelId.get(key) ?? 0) + 1)
  }

  const rows: EarningStructureSummaryRow[] = mappings.map((mapping) => {
    const levelId = mapping.level_id
    const structureInfo = mapping.salary_structures
    const allowanceStats = allowanceStatsByStructure.get(mapping.structure_id)
    const allowancesCount = allowanceStats ? allowanceStats.activeAllowanceIds.size : 0
    const employeesCount = employeeCountByLevelId.get(levelId) ?? 0
    const status: 'active' | 'disabled' =
      allowanceStats && allowanceStats.hasAllowance && !allowanceStats.hasActiveAllowance
        ? 'disabled'
        : 'active'

    return {
      mapping_id: mapping.id,
      structure_id: structureInfo.id,
      structure_name: structureInfo.name,
      level_id: levelId,
      level_name: levelId ? (levelNameById.get(levelId) ?? 'Unknown level') : 'Default',
      allowances_count: allowancesCount,
      employees_count: employeesCount,
      status,
      created_at: structureInfo.created_at,
    }
  })

  rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return {
    rows,
    levels: [
      { id: null, name: 'Default' },
      ...Array.from(levelNameById).map(([id, name]) => ({ id, name })),
    ],
  }
}
