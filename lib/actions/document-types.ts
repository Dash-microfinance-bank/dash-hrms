'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const DOCUMENT_TYPES_PATH = '/dashboard/admin/document-types'

const ADMIN_ROLES = ['super_admin', 'hr', 'finance'] as const

export type DocumentTypeActionResult =
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
    return { error: 'You do not have permission to manage document types' } as const
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

type DocumentTypeOwnerType = 'USER' | 'ORGANIZATION' | 'DEPARTMENT'

/** Create an organization-scoped document type. Name must be unique within the organization. */
export async function createDocumentType(params: {
  name: string
  document_category_id: string
  owner_type: DocumentTypeOwnerType
  is_required: boolean
  approval_required: boolean
  allow_multiple: boolean
}): Promise<DocumentTypeActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const { supabase, orgId } = ctx
  const trimmed = params.name.trim()
  if (!trimmed) return { success: false, error: 'Name is required' }
  if (!params.document_category_id) return { success: false, error: 'Category is required' }

  // Category must belong to this org or be system default (organization_id IS NULL)
  const { data: categoryRow } = await supabase
    .from('document_categories')
    .select('id, organization_id')
    .eq('id', params.document_category_id)
    .single()

  if (!categoryRow) return { success: false, error: 'Invalid category' }
  const catOrgId = (categoryRow as { organization_id: string | null }).organization_id
  if (catOrgId !== null && catOrgId !== orgId) {
    return { success: false, error: 'You can only use categories from your organization or system defaults.' }
  }

  const { data: existingInOrg } = await supabase
    .from('document_types')
    .select('id')
    .eq('organization_id', orgId)
    .ilike('name', trimmed)
    .maybeSingle()

  if (existingInOrg) {
    return { success: false, error: 'A document type with this name already exists in your organization.' }
  }

  const isOrganizationLevel = params.owner_type === 'ORGANIZATION'

  const { error } = await supabase.from('document_types').insert({
    organization_id: orgId,
    name: trimmed,
    // DB columns: category_id / required / required_approval
    category_id: params.document_category_id,
    owner_type: params.owner_type,
    required: isOrganizationLevel ? false : params.is_required,
    requires_approval: isOrganizationLevel ? false : params.approval_required,
    allow_multiple: params.allow_multiple,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(DOCUMENT_TYPES_PATH)
  return { success: true }
}

/** Update document type. Only allowed for org-owned rows. Name unique per org. */
export async function updateDocumentType(
  id: string,
  params: {
    name: string
    document_category_id: string
    is_required: boolean
    approval_required: boolean
    allow_multiple: boolean
  }
): Promise<DocumentTypeActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const { supabase, orgId } = ctx
  const trimmed = params.name.trim()
  if (!trimmed) return { success: false, error: 'Name is required' }
  if (!params.document_category_id) return { success: false, error: 'Category is required' }

  const { data: row, error: fetchError } = await supabase
    .from('document_types')
    .select('id, organization_id')
    .eq('id', id)
    .single()

  if (fetchError || !row) return { success: false, error: 'Document type not found' }

  const rec = row as { organization_id: string }
  if (rec.organization_id !== orgId) {
    return { success: false, error: 'You can only edit document types in your organization.' }
  }

  const { data: categoryRow } = await supabase
    .from('document_categories')
    .select('id, organization_id')
    .eq('id', params.document_category_id)
    .single()

  if (!categoryRow) return { success: false, error: 'Invalid category' }
  const catOrgId = (categoryRow as { organization_id: string | null }).organization_id
  if (catOrgId !== null && catOrgId !== orgId) {
    return { success: false, error: 'You can only use categories from your organization or system defaults.' }
  }

  const { data: duplicateInOrg } = await supabase
    .from('document_types')
    .select('id')
    .eq('organization_id', orgId)
    .ilike('name', trimmed)
    .neq('id', id)
    .maybeSingle()

  if (duplicateInOrg) {
    return { success: false, error: 'A document type with this name already exists in your organization.' }
  }

  const { error } = await supabase
    .from('document_types')
    .update({
      name: trimmed,
      // DB columns: category_id / required / required_approval
      category_id: params.document_category_id,
      required: params.is_required,
      requires_approval: params.approval_required,
      allow_multiple: params.allow_multiple,
    })
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) return { success: false, error: error.message }

  revalidatePath(DOCUMENT_TYPES_PATH)
  return { success: true }
}

/** Delete document type. Only allowed for org-owned rows. */
export async function deleteDocumentType(id: string): Promise<DocumentTypeActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const { supabase, orgId } = ctx

  const { data: row, error: fetchError } = await supabase
    .from('document_types')
    .select('id, organization_id')
    .eq('id', id)
    .single()

  if (fetchError || !row) return { success: false, error: 'Document type not found' }

  const rec = row as { organization_id: string }
  if (rec.organization_id !== orgId) {
    return { success: false, error: 'You can only delete document types in your organization.' }
  }

  const { error } = await supabase
    .from('document_types')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) return { success: false, error: error.message }

  revalidatePath(DOCUMENT_TYPES_PATH)
  return { success: true }
}
