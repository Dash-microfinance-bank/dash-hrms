'use server'

import { createClient } from '@/lib/supabase/server'

export type DocumentCategoryRow = {
  id: string
  organization_id: string | null
  name: string
  system_default: boolean
  created_at: string
}

/**
 * Fetches document categories for the current user's organization.
 * Returns the union of:
 * - System defaults: organization_id IS NULL (read-only in the UI).
 * - Org-scoped: organization_id = current user's org (editable/deletable by org).
 * Returns an empty array if unauthenticated or org is missing.
 */
export async function getDocumentCategoriesForCurrentOrg(): Promise<DocumentCategoryRow[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!myProfile?.organization_id) return []

  const orgId = myProfile.organization_id

  // System defaults (organization_id IS NULL) + this org's categories (organization_id = orgId)
  const { data, error } = await supabase
    .from('document_categories')
    .select('id, organization_id, name, system_default, created_at')
    .or(`organization_id.eq.${orgId},organization_id.is.null`)
    .order('name', { ascending: true })

  if (error) {
    console.error('[DocumentCategories] Failed to fetch:', error)
    return []
  }

  return (data ?? []) as DocumentCategoryRow[]
}
