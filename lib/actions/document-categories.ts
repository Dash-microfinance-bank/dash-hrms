'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const DOCUMENT_CATEGORIES_PATH = '/dashboard/admin/document-categories'

const ADMIN_ROLES = ['super_admin', 'hr', 'finance'] as const

export type DocumentCategoryActionResult =
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
    return { error: 'You do not have permission to manage document categories' } as const
  }

  return {
    supabase,
    user,
    orgId,
  } as {
    supabase: Awaited<ReturnType<typeof createClient>>
    user: NonNullable<Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']>
    orgId: string
  }
}

/** Create an organization-scoped category. Name must be unique in org and not match a system default. */
export async function createDocumentCategory(name: string): Promise<DocumentCategoryActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const { supabase, orgId } = ctx
  const trimmed = name.trim()
  if (!trimmed) return { success: false, error: 'Name is required' }

  const { data: existingInOrg } = await supabase
    .from('document_categories')
    .select('id')
    .eq('organization_id', orgId)
    .ilike('name', trimmed)
    .maybeSingle()

  if (existingInOrg) {
    return { success: false, error: 'A category with this name already exists in your organization.' }
  }

  const { data: systemDefaultWithName } = await supabase
    .from('document_categories')
    .select('id')
    .is('organization_id', null)
    .ilike('name', trimmed)
    .maybeSingle()

  if (systemDefaultWithName) {
    return { success: false, error: 'This name is reserved for a system default category.' }
  }

  const { error } = await supabase.from('document_categories').insert({
    organization_id: orgId,
    name: trimmed,
    system_default: false,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(DOCUMENT_CATEGORIES_PATH)
  return { success: true }
}

/** Update category name. Only allowed for org-owned, non–system-default rows. Name unique per org and must not match a system default. */
export async function updateDocumentCategory(
  id: string,
  name: string
): Promise<DocumentCategoryActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const { supabase, orgId } = ctx
  const trimmed = name.trim()
  if (!trimmed) return { success: false, error: 'Name is required' }

  const { data: row, error: fetchError } = await supabase
    .from('document_categories')
    .select('id, organization_id, system_default')
    .eq('id', id)
    .single()

  if (fetchError || !row) return { success: false, error: 'Category not found' }

  const rec = row as { organization_id: string | null; system_default: boolean }
  if (rec.organization_id !== orgId) {
    return { success: false, error: 'You can only edit categories in your organization.' }
  }
  if (rec.system_default) {
    return { success: false, error: 'System default categories cannot be edited.' }
  }

  const { data: duplicateInOrg } = await supabase
    .from('document_categories')
    .select('id')
    .eq('organization_id', orgId)
    .ilike('name', trimmed)
    .neq('id', id)
    .maybeSingle()

  if (duplicateInOrg) {
    return { success: false, error: 'A category with this name already exists in your organization.' }
  }

  const { data: systemDefaultWithName } = await supabase
    .from('document_categories')
    .select('id')
    .is('organization_id', null)
    .ilike('name', trimmed)
    .maybeSingle()

  if (systemDefaultWithName) {
    return { success: false, error: 'This name is reserved for a system default category.' }
  }

  const { error } = await supabase
    .from('document_categories')
    .update({ name: trimmed })
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) return { success: false, error: error.message }

  revalidatePath(DOCUMENT_CATEGORIES_PATH)
  return { success: true }
}

/** Delete category. Only allowed for org-owned, non–system-default rows. */
export async function deleteDocumentCategory(id: string): Promise<DocumentCategoryActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const { supabase, orgId } = ctx

  const { data: row, error: fetchError } = await supabase
    .from('document_categories')
    .select('id, organization_id, system_default')
    .eq('id', id)
    .single()

  if (fetchError || !row) return { success: false, error: 'Category not found' }

  const rec = row as { organization_id: string | null; system_default: boolean }
  if (rec.organization_id !== orgId) {
    return { success: false, error: 'You can only delete categories in your organization.' }
  }
  if (rec.system_default) {
    return { success: false, error: 'System default categories cannot be deleted.' }
  }

  const { error } = await supabase
    .from('document_categories')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) return { success: false, error: error.message }

  revalidatePath(DOCUMENT_CATEGORIES_PATH)
  return { success: true }
}
