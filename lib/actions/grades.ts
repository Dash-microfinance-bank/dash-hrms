'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const ADMIN_ROLES = ['super_admin', 'hr', 'finance'] as const

export type GradeActionResult =
  | { success: true }
  | { success: false; error: string }

type GradeInput = {
  name: string
  code?: string | null
  level?: number | null
  min_salary?: number | null
  max_salary?: number | null
  currency?: string | null
}

const GRADES_PATH = '/dashboard/admin/grades'

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
    return { error: 'You do not have permission to manage grades' } as const
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

export async function createGrade(input: GradeInput): Promise<GradeActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx

  const name = input.name.trim()
  const code = input.code?.trim() || null
  const level = input.level ?? null
  const minSalary = input.min_salary ?? null
  const maxSalary = input.max_salary ?? null
  const currency = (input.currency ?? 'NGN').trim() || 'NGN'

  if (!name) {
    return { success: false, error: 'Name is required' }
  }

  if (minSalary !== null && maxSalary !== null && minSalary > maxSalary) {
    return { success: false, error: 'Minimum salary cannot be greater than maximum salary' }
  }

  const { error } = await supabase.from('grades').insert({
    organization_id: orgId,
    name,
    code,
    level,
    min_salary: minSalary,
    max_salary: maxSalary,
    currency,
  })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('grades_org_name_key')) {
      return { success: false, error: 'A grade with this name already exists' }
    }
    if (msg.includes('grades_org_code_key')) {
      return { success: false, error: 'A grade with this code already exists' }
    }
    return { success: false, error: error.message }
  }

  revalidatePath(GRADES_PATH)
  return { success: true }
}

export async function updateGrade(
  id: string,
  input: GradeInput
): Promise<GradeActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx

  const { data: existing, error: fetchError } = await supabase
    .from('grades')
    .select('id, organization_id')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Grade not found' }
  }

  if (existing.organization_id !== orgId) {
    return { success: false, error: 'Cannot edit a grade from another organization' }
  }

  const name = input.name.trim()
  const code = input.code?.trim() || null
  const level = input.level ?? null
  const minSalary = input.min_salary ?? null
  const maxSalary = input.max_salary ?? null
  const currency = (input.currency ?? 'NGN').trim() || 'NGN'

  if (!name) {
    return { success: false, error: 'Name is required' }
  }

  if (minSalary !== null && maxSalary !== null && minSalary > maxSalary) {
    return { success: false, error: 'Minimum salary cannot be greater than maximum salary' }
  }

  const { error } = await supabase
    .from('grades')
    .update({
      name,
      code,
      level,
      min_salary: minSalary,
      max_salary: maxSalary,
      currency,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('grades_org_name_key')) {
      return { success: false, error: 'A grade with this name already exists' }
    }
    if (msg.includes('grades_org_code_key')) {
      return { success: false, error: 'A grade with this code already exists' }
    }
    return { success: false, error: error.message }
  }

  revalidatePath(GRADES_PATH)
  return { success: true }
}

export async function deleteGrade(id: string): Promise<GradeActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx

  const { error } = await supabase
    .from('grades')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(GRADES_PATH)
  return { success: true }
}

