'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const ADMIN_ROLES = ['super_admin', 'hr', 'finance'] as const

export type JobRoleActionResult =
  | { success: true }
  | { success: false; error: string }

type JobRoleInput = {
  name: string
  code?: string | null
  department_id: string
}

const JOB_ROLES_PATH = '/dashboard/admin/job-roles'

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
    return { error: 'You do not have permission to manage job roles' } as const
  }

  return {
    supabase,
    user,
    orgId,
  } as {
    supabase: typeof supabase
    user: typeof user
    orgId: string
  }
}

export async function createJobRole(input: JobRoleInput): Promise<JobRoleActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx

  const name = input.name.trim()
  const code = input.code?.trim() || null
  const departmentId = input.department_id

  if (!name) {
    return { success: false, error: 'Title is required' }
  }

  if (!departmentId) {
    return { success: false, error: 'Department is required' }
  }

  const { data: department, error: deptError } = await supabase
    .from('departments')
    .select('id, organization_id, is_active')
    .eq('id', departmentId)
    .single()

  if (deptError || !department) {
    return { success: false, error: 'Selected department was not found' }
  }

  if (department.organization_id !== orgId) {
    return {
      success: false,
      error: 'You can only assign job roles to departments in your organization',
    }
  }

  if (department.is_active === false) {
    return {
      success: false,
      error: 'You cannot assign a job role to an inactive department',
    }
  }

  const { error } = await supabase.from('job_roles').insert({
    organization_id: orgId,
    title: name,
    code,
    department_id: departmentId,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(JOB_ROLES_PATH)
  return { success: true }
}

export async function updateJobRole(
  id: string,
  input: JobRoleInput
): Promise<JobRoleActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx

  const { data: existing, error: fetchError } = await supabase
    .from('job_roles')
    .select('id, organization_id, department_id')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Job role not found' }
  }

  if (existing.organization_id !== orgId) {
    return { success: false, error: 'Cannot edit a job role from another organization' }
  }

  const name = input.name.trim()
  const code = input.code?.trim() || null
  const departmentId = input.department_id

  if (!name) {
    return { success: false, error: 'Title is required' }
  }

  if (!departmentId) {
    return { success: false, error: 'Department is required' }
  }

  const { data: department, error: deptError } = await supabase
    .from('departments')
    .select('id, organization_id, is_active')
    .eq('id', departmentId)
    .single()

  if (deptError || !department) {
    return { success: false, error: 'Selected department was not found' }
  }

  if (department.organization_id !== orgId) {
    return {
      success: false,
      error: 'You can only assign job roles to departments in your organization',
    }
  }

  if (department.is_active === false) {
    return {
      success: false,
      error: 'You cannot assign a job role to an inactive department',
    }
  }

  const { error } = await supabase
    .from('job_roles')
    .update({
      title: name,
      code,
      department_id: departmentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(JOB_ROLES_PATH)
  return { success: true }
}

export async function deleteJobRole(id: string): Promise<JobRoleActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx

  const { error } = await supabase
    .from('job_roles')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(JOB_ROLES_PATH)
  return { success: true }
}


