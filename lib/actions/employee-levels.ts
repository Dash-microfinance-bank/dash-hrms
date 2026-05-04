'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const ADMIN_ROLES = ['super_admin', 'hr', 'finance'] as const
const LEVELS_PATH = '/dashboard/admin/levels'

export type EmployeeLevelActionResult =
  | { success: true }
  | { success: false; error: string }

type EmployeeLevelInput = {
  name: string
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
    return { error: 'You do not have permission to manage levels' } as const
  }

  return { supabase, orgId } as { supabase: typeof supabase; orgId: string }
}

export async function createEmployeeLevel(
  input: EmployeeLevelInput
): Promise<EmployeeLevelActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx
  const name = input.name.trim()

  if (!name) {
    return { success: false, error: 'Name is required' }
  }

  const { error } = await supabase
    .from('employee_levels')
    .insert({ organization_id: orgId, name })

  if (error) return { success: false, error: error.message }

  revalidatePath(LEVELS_PATH)
  return { success: true }
}

export async function updateEmployeeLevel(
  id: string,
  input: EmployeeLevelInput
): Promise<EmployeeLevelActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx
  const name = input.name.trim()

  if (!name) {
    return { success: false, error: 'Name is required' }
  }

  const { data: existing, error: fetchError } = await supabase
    .from('employee_levels')
    .select('id, organization_id')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Level not found' }
  }

  if (existing.organization_id !== orgId) {
    return { success: false, error: 'Cannot edit a level from another organization' }
  }

  const { error } = await supabase
    .from('employee_levels')
    .update({ name })
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) return { success: false, error: error.message }

  revalidatePath(LEVELS_PATH)
  return { success: true }
}

export async function deleteEmployeeLevel(id: string): Promise<EmployeeLevelActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx

  const { error } = await supabase
    .from('employee_levels')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('level_salary_structure') || msg.includes('foreign key')) {
      return { success: false, error: 'This level is in use and cannot be deleted' }
    }
    return { success: false, error: error.message }
  }

  revalidatePath(LEVELS_PATH)
  return { success: true }
}
