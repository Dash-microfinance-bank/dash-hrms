'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const ADMIN_ROLES = ['super_admin', 'hr', 'finance'] as const
const EARNING_STRUCTURE_PATH = '/dashboard/admin/payroll/earning-structure'

export type EarningStructureSummaryActionResult =
  | { success: true }
  | { success: false; error: string }

type EditStructureInput = {
  name: string
  level_id: string | null
}

type CreateStructureInput = {
  name: string
  level_id: string | null
}

async function getAdminContext() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' } as const
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return { error: 'Organization not found' } as const
  }

  const orgId = profile.organization_id

  const { data: rolesData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)

  const roles = (rolesData ?? []).map((r) => r.role as string)
  const hasAdminRole = roles.some((r) => ADMIN_ROLES.includes(r as (typeof ADMIN_ROLES)[number]))

  if (!hasAdminRole) {
    return { error: 'You do not have permission to manage earning structures' } as const
  }

  return { supabase, orgId } as { supabase: typeof supabase; orgId: string }
}

async function validateMappingAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  mappingId: string
): Promise<
  | { error: string }
  | {
      mapping: {
        id: string
        structure_id: string
        level_id: string | null
        salary_structure: { id: string; organization_id: string }
      }
    }
> {
  const { data: mapping, error } = await supabase
    .from('level_salary_structure')
    .select('id, structure_id, level_id, salary_structures!inner(id, organization_id)')
    .eq('id', mappingId)
    .single()

  if (error || !mapping) return { error: 'Structure mapping not found' as const }

  const raw = mapping as {
    id: string
    structure_id: string
    level_id: string | null
    salary_structures:
      | { id: string; organization_id: string }
      | Array<{ id: string; organization_id: string }>
      | null
  }

  const salaryStructure = Array.isArray(raw.salary_structures)
    ? raw.salary_structures[0]
    : raw.salary_structures

  if (!salaryStructure) return { error: 'Structure mapping not found' }
  if (salaryStructure.organization_id !== orgId) {
    return { error: 'Cannot manage structures from another organization' as const }
  }

  return {
    mapping: {
      id: raw.id,
      structure_id: raw.structure_id,
      level_id: raw.level_id,
      salary_structure: salaryStructure,
    },
  }
}

export async function updateEarningStructureSummary(
  mappingId: string,
  input: EditStructureInput
): Promise<EarningStructureSummaryActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }
  const { supabase, orgId } = ctx

  const found = await validateMappingAccess(supabase, orgId, mappingId)
  if ('error' in found) return { success: false, error: found.error }
  if (found.mapping.level_id === null) {
    return { success: false, error: 'Default structure cannot be edited' }
  }

  const structureId = found.mapping.structure_id
  const nextLevelId = input.level_id
  const name = input.name.trim()
  if (!name) return { success: false, error: 'Structure name is required' }

  const { error: structureError } = await supabase
    .from('salary_structures')
    .update({ name })
    .eq('id', structureId)
    .eq('organization_id', orgId)
  if (structureError) return { success: false, error: structureError.message }

  const { error: mappingError } = await supabase
    .from('level_salary_structure')
    .update({ level_id: nextLevelId })
    .eq('id', mappingId)
  if (mappingError) return { success: false, error: mappingError.message }

  revalidatePath(EARNING_STRUCTURE_PATH)
  return { success: true }
}

export async function createEarningStructureSummary(
  input: CreateStructureInput
): Promise<EarningStructureSummaryActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }
  const { supabase, orgId } = ctx

  const name = input.name.trim()
  if (!name) return { success: false, error: 'Structure name is required' }

  const { data: existingLevelMapping } = await supabase
    .from('level_salary_structure')
    .select('id, level_id, salary_structures!inner(id, organization_id)')
    .eq('salary_structures.organization_id', orgId)
    .is('level_id', input.level_id)
    .maybeSingle()

  if (existingLevelMapping) {
    return { success: false, error: 'Selected level is already assigned to another structure' }
  }

  const { data: insertedStructure, error: structureError } = await supabase
    .from('salary_structures')
    .insert({
      organization_id: orgId,
      name,
    })
    .select('id')
    .single()
  if (structureError || !insertedStructure) {
    return { success: false, error: structureError?.message ?? 'Failed to create structure' }
  }

  const { error: mappingError } = await supabase.from('level_salary_structure').insert({
    structure_id: insertedStructure.id,
    level_id: input.level_id,
    is_default: input.level_id === null,
  })

  if (mappingError) return { success: false, error: mappingError.message }

  revalidatePath(EARNING_STRUCTURE_PATH)
  return { success: true }
}

export async function disableEarningStructureSummary(
  mappingId: string
): Promise<EarningStructureSummaryActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }
  const { supabase, orgId } = ctx

  const found = await validateMappingAccess(supabase, orgId, mappingId)
  if ('error' in found) return { success: false, error: found.error }
  if (found.mapping.level_id === null) {
    return { success: false, error: 'Default structure cannot be disabled' }
  }

  const structureId = found.mapping.structure_id

  const { data: componentLinks, error: linksError } = await supabase
    .from('salary_structure_components')
    .select('salary_component_id')
    .eq('salary_structure_id', structureId)

  if (linksError) return { success: false, error: linksError.message }

  const componentIds = [...new Set((componentLinks ?? []).map((x) => x.salary_component_id))]
  if (componentIds.length > 0) {
    const { error: disableError } = await supabase
      .from('salary_components')
      .update({ is_active: false })
      .in('id', componentIds)
      .eq('organization_id', orgId)
      .eq('type', 'ALLOWANCE')
    if (disableError) return { success: false, error: disableError.message }
  }

  revalidatePath(EARNING_STRUCTURE_PATH)
  return { success: true }
}

export async function deleteEarningStructureSummary(
  mappingId: string
): Promise<EarningStructureSummaryActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }
  const { supabase, orgId } = ctx

  const found = await validateMappingAccess(supabase, orgId, mappingId)
  if ('error' in found) return { success: false, error: found.error }
  if (found.mapping.level_id === null) {
    return { success: false, error: 'Default structure cannot be deleted' }
  }
  const { structure_id: structureId } = found.mapping

  const { error: deleteMappingError } = await supabase
    .from('level_salary_structure')
    .delete()
    .eq('id', mappingId)
  if (deleteMappingError) return { success: false, error: deleteMappingError.message }

  const { count: remainingMappings, error: remainingMappingsError } = await supabase
    .from('level_salary_structure')
    .select('id', { count: 'exact', head: true })
    .eq('structure_id', structureId)
  if (remainingMappingsError) return { success: false, error: remainingMappingsError.message }

  if ((remainingMappings ?? 0) === 0) {
    const { error: deleteComponentsError } = await supabase
      .from('salary_structure_components')
      .delete()
      .eq('salary_structure_id', structureId)
    if (deleteComponentsError) return { success: false, error: deleteComponentsError.message }

    const { error: deleteStructureError } = await supabase
      .from('salary_structures')
      .delete()
      .eq('id', structureId)
      .eq('organization_id', orgId)
    if (deleteStructureError) return { success: false, error: deleteStructureError.message }
  }

  revalidatePath(EARNING_STRUCTURE_PATH)
  return { success: true }
}
