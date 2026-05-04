'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { PHASES } from '@/lib/data/earning-structure-detail'

const ADMIN_ROLES = ['super_admin', 'hr', 'finance'] as const
const EARNING_STRUCTURE_LIST_PATH = '/dashboard/admin/payroll/earning-structure'

export type EarningStructureComponentActionResult =
  | { success: true }
  | { success: false; error: string }

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
    return { error: 'You do not have permission to manage structure allowances' } as const
  }

  return { supabase, orgId } as { supabase: typeof supabase; orgId: string }
}

async function validateAssignmentAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  assignmentId: string
): Promise<
  | { error: string }
  | {
      assignment: {
        id: string
        salary_structure_id: string
      }
    }
> {
  const { data, error } = await supabase
    .from('salary_structure_components')
    .select('id, salary_structure_id, salary_structures!inner(organization_id)')
    .eq('id', assignmentId)
    .single()

  if (error || !data) return { error: 'Allowance assignment not found' as const }

  const raw = data as {
    id: string
    salary_structure_id: string
    salary_structures:
      | { organization_id: string }
      | Array<{ organization_id: string }>
      | null
  }

  const salaryStructure = Array.isArray(raw.salary_structures)
    ? raw.salary_structures[0]
    : raw.salary_structures

  if (!salaryStructure) return { error: 'Allowance assignment not found' as const }
  if (salaryStructure.organization_id !== orgId) {
    return { error: 'Cannot manage allowance assignments from another organization' as const }
  }

  return {
    assignment: {
      id: raw.id,
      salary_structure_id: raw.salary_structure_id,
    },
  }
}

async function validateStructureAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  structureId: string
): Promise<
  | { error: string }
  | {
      structure: {
        id: string
      }
    }
> {
  const { data, error } = await supabase
    .from('salary_structures')
    .select('id, organization_id')
    .eq('id', structureId)
    .eq('organization_id', orgId)
    .single()

  if (error || !data) return { error: 'Earning structure not found' }
  return { structure: { id: data.id } }
}

function revalidateStructurePaths(structureId: string) {
  revalidatePath(EARNING_STRUCTURE_LIST_PATH)
  revalidatePath(`${EARNING_STRUCTURE_LIST_PATH}/${structureId}`)
}

export async function updateStructureAllowanceAssignment(
  assignmentId: string,
  input: { value: number | null }
): Promise<EarningStructureComponentActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }
  const { supabase, orgId } = ctx

  const found = await validateAssignmentAccess(supabase, orgId, assignmentId)
  if ('error' in found) return { success: false, error: found.error }

  if (input.value !== null && !Number.isFinite(input.value)) {
    return { success: false, error: 'Invalid value' }
  }

  const { error } = await supabase
    .from('salary_structure_components')
    .update({ value: input.value })
    .eq('id', assignmentId)

  if (error) return { success: false, error: error.message }

  revalidateStructurePaths(found.assignment.salary_structure_id)
  return { success: true }
}

export async function deleteStructureAllowanceAssignment(
  assignmentId: string
): Promise<EarningStructureComponentActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }
  const { supabase, orgId } = ctx

  const found = await validateAssignmentAccess(supabase, orgId, assignmentId)
  if ('error' in found) return { success: false, error: found.error }

  const { error } = await supabase.from('salary_structure_components').delete().eq('id', assignmentId)
  if (error) return { success: false, error: error.message }

  revalidateStructurePaths(found.assignment.salary_structure_id)
  return { success: true }
}

export async function disableStructureAllowanceAssignment(
  assignmentId: string
): Promise<EarningStructureComponentActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }
  const { supabase, orgId } = ctx

  const found = await validateAssignmentAccess(supabase, orgId, assignmentId)
  if ('error' in found) return { success: false, error: found.error }

  const { error } = await supabase
    .from('salary_structure_components')
    .update({ value: 0 })
    .eq('id', assignmentId)

  if (error) return { success: false, error: error.message }

  revalidateStructurePaths(found.assignment.salary_structure_id)
  return { success: true }
}

export async function createStructureAllowanceAssignment(input: {
  structure_id: string
  salary_component_id: string
  value: number
}): Promise<EarningStructureComponentActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }
  const { supabase, orgId } = ctx

  if (!Number.isFinite(input.value) || input.value < 0) {
    return { success: false, error: 'Value must be a valid non-negative number' }
  }

  const structureAccess = await validateStructureAccess(supabase, orgId, input.structure_id)
  if ('error' in structureAccess) return { success: false, error: structureAccess.error }

  const { data: allowance, error: allowanceError } = await supabase
    .from('salary_components')
    .select('id, organization_id, type, is_active')
    .eq('id', input.salary_component_id)
    .single()

  if (allowanceError || !allowance) {
    return { success: false, error: 'Allowance not found' }
  }

  if (allowance.organization_id !== orgId || allowance.type !== 'ALLOWANCE') {
    return { success: false, error: 'Cannot attach this allowance to the selected structure' }
  }

  if (allowance.is_active === false) {
    return { success: false, error: 'This allowance is disabled and cannot be attached to a structure' }
  }

  const { data: existing } = await supabase
    .from('salary_structure_components')
    .select('id')
    .eq('salary_structure_id', input.structure_id)
    .eq('salary_component_id', input.salary_component_id)
    .maybeSingle()

  if (existing) {
    return { success: false, error: 'This allowance is already assigned to the selected structure' }
  }

  const { error: insertError } = await supabase.from('salary_structure_components').insert({
    salary_structure_id: input.structure_id,
    salary_component_id: input.salary_component_id,
    value: input.value,
    priority: PHASES.ALLOWANCE,
  })

  if (insertError) return { success: false, error: insertError.message }

  revalidateStructurePaths(input.structure_id)
  return { success: true }
}
