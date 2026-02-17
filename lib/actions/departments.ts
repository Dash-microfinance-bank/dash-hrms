'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const ADMIN_ROLES = ['super_admin', 'hr', 'finance'] as const

export type DepartmentActionResult =
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
    return { error: 'You do not have permission to manage departments' } as const
  }

  // Ensure a single return type where error is always a string when present
  return { supabase, user, orgId } as { supabase: typeof supabase; user: typeof user; orgId: string }
}

type DepartmentInput = {
  name: string
  code?: string | null
  description?: string | null
  parent_department_id?: string | null
}

const DEPARTMENTS_PATH = '/dashboard/admin/departments'

export async function createDepartment(input: DepartmentInput): Promise<DepartmentActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx

  const name = input.name.trim()
  const code = input.code?.trim() || null
  const description = input.description?.trim() || null
  const parentDepartmentId = input.parent_department_id?.trim() || null

  if (!name) {
    return { success: false, error: 'Name is required' }
  }

  if (parentDepartmentId) {
    const { data: parent, error: parentError } = await supabase
      .from('departments')
      .select('id, organization_id')
      .eq('id', parentDepartmentId)
      .single()
    if (parentError || !parent) {
      return { success: false, error: 'Parent department not found' }
    }
    if (parent.organization_id !== orgId) {
      return { success: false, error: 'Parent department must belong to your organization' }
    }
  }

  const { error } = await supabase
    .from('departments')
    .insert({
      organization_id: orgId,
      name,
      code,
      description,
      parent_department_id: parentDepartmentId,
    })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('departments_org_name_key')) {
      return { success: false, error: 'A department with this name already exists' }
    }
    if (msg.includes('departments_org_code_key')) {
      return { success: false, error: 'A department with this code already exists' }
    }
    return { success: false, error: error.message }
  }

  revalidatePath(DEPARTMENTS_PATH)
  return { success: true }
}

export async function updateDepartment(
  id: string,
  input: DepartmentInput & { is_active?: boolean }
): Promise<DepartmentActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx

  const { data: existing, error: fetchError } = await supabase
    .from('departments')
    .select('id, organization_id')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Department not found' }
  }

  if (existing.organization_id !== orgId) {
    return { success: false, error: 'Cannot edit a department from another organization' }
  }

  const name = input.name.trim()
  const code = input.code?.trim() || null
  const description = input.description?.trim() || null
  const parentDepartmentId = input.parent_department_id !== undefined ? (input.parent_department_id?.trim() || null) : undefined

  if (!name) {
    return { success: false, error: 'Name is required' }
  }

  if (parentDepartmentId !== undefined) {
    if (parentDepartmentId === id) {
      return { success: false, error: 'A department cannot be its own parent' }
    }
    if (parentDepartmentId) {
      const { data: allDepts } = await supabase
        .from('departments')
        .select('id, parent_department_id')
        .eq('organization_id', orgId)
      const depts = (allDepts ?? []) as Array<{ id: string; parent_department_id: string | null }>
      const descendantIds = new Set<string>()
      const collectDescendants = (parentId: string) => {
        for (const d of depts) {
          if (d.parent_department_id === parentId && d.id !== parentId) {
            descendantIds.add(d.id)
            collectDescendants(d.id)
          }
        }
      }
      collectDescendants(id)
      if (descendantIds.has(parentDepartmentId)) {
        return {
          success: false,
          error:
            'You cannot select a department that is already a child or grandchild of this department',
        }
      }
      const { data: parent, error: parentError } = await supabase
        .from('departments')
        .select('id, organization_id')
        .eq('id', parentDepartmentId)
        .single()
      if (parentError || !parent) {
        return { success: false, error: 'Parent department not found' }
      }
      if (parent.organization_id !== orgId) {
        return { success: false, error: 'Parent department must belong to your organization' }
      }
    }
  }

  const updatePayload: Record<string, unknown> = {
    name,
    code,
    description,
    is_active: input.is_active ?? true,
    updated_at: new Date().toISOString(),
  }
  if (parentDepartmentId !== undefined) {
    updatePayload.parent_department_id = parentDepartmentId
  }

  const { error } = await supabase
    .from('departments')
    .update(updatePayload)
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('departments_org_name_key')) {
      return { success: false, error: 'A department with this name already exists' }
    }
    if (msg.includes('departments_org_code_key')) {
      return { success: false, error: 'A department with this code already exists' }
    }
    return { success: false, error: error.message }
  }

  revalidatePath(DEPARTMENTS_PATH)
  return { success: true }
}

export async function deleteDepartment(id: string): Promise<DepartmentActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx

  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('job_roles_department_fk')) {
      return {
        success: false,
        error: 'This department is in use by job roles and cannot be deleted',
      }
    }
    return { success: false, error: error.message }
  }

  revalidatePath(DEPARTMENTS_PATH)
  return { success: true }
}

