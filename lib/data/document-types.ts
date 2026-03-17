'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Logical shape used everywhere in the app (table, modals, actions).
 * DB column names differ:  category_id, required, requires_approval.
 * The fetch function maps them explicitly below.
 */
export type DocumentTypeRow = {
  id: string
  organization_id: string | null
  name: string
  document_category_id: string | null  // DB: category_id
  is_required: boolean                 // DB: required
  approval_required: boolean           // DB: requires_approval
  has_expiry: boolean
  created_at: string
  document_categories?: { name: string } | null
}

/** Raw shape returned directly by Supabase — matches actual DB columns. */
type RawDocumentTypeRow = {
  id: string
  organization_id: string | null
  name: string
  category_id: string | null
  required: boolean
  requires_approval: boolean
  has_expiry: boolean
  created_at: string
}

/**
 * Maps a raw Supabase DB row to the logical DocumentTypeRow shape used by the UI.
 * This is the single source of truth for the column-name translation.
 */
function mapRow(
  raw: RawDocumentTypeRow,
  categoryNameById: Map<string, string>,
): DocumentTypeRow {
  return {
    id: raw.id,
    organization_id: raw.organization_id,
    name: raw.name,
    document_category_id: raw.category_id,
    is_required: raw.required ?? false,
    approval_required: raw.requires_approval ?? false,
    has_expiry: raw.has_expiry ?? false,
    created_at: raw.created_at,
    document_categories:
      raw.category_id && categoryNameById.has(raw.category_id)
        ? { name: categoryNameById.get(raw.category_id)! }
        : null,
  }
}

/**
 * Fetches document types for the current user's organization (org-scoped only).
 * Resolves the category name separately and hydrates `document_categories.name`.
 * Returns [] if unauthenticated or org is missing.
 */
export async function getDocumentTypesForCurrentOrg(): Promise<DocumentTypeRow[]> {
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

  // Select real DB column names — no aliasing, no magic casts.
  const { data: rawData, error } = await supabase
    .from('document_types')
    .select('id, organization_id, name, category_id, required, requires_approval, has_expiry, created_at')
    .eq('organization_id', orgId)
    .order('name', { ascending: true })

  if (error) {
    console.error('[DocumentTypes] Failed to fetch types:', JSON.stringify(error))
    return []
  }

  const rawRows = (rawData ?? []) as RawDocumentTypeRow[]
  if (rawRows.length === 0) return []

  // Resolve category names in a single query.
  const categoryIds = [...new Set(rawRows.map((r) => r.category_id).filter((id): id is string => !!id))]
  const categoryNameById = new Map<string, string>()

  if (categoryIds.length > 0) {
    const { data: categoriesData } = await supabase
      .from('document_categories')
      .select('id, name')
      .in('id', categoryIds)

    for (const c of (categoriesData ?? []) as { id: string; name: string }[]) {
      categoryNameById.set(c.id, c.name)
    }
  }

  return rawRows.map((r) => mapRow(r, categoryNameById))
}
