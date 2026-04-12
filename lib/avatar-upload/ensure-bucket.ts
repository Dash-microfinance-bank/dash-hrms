import type { SupabaseClient } from '@supabase/supabase-js'
import { ORGANIZATIONS_STORAGE_BUCKET } from './constants'

/**
 * Verifies the shared `organizations` bucket is reachable (already exists in project).
 * We do not create or mutate this bucket here — it is org-wide and may have
 * existing policies and MIME/size rules managed in Supabase.
 */
export async function ensureOrganizationsBucket(
  admin: SupabaseClient,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await admin.storage.getBucket(ORGANIZATIONS_STORAGE_BUCKET)

  if (data && !error) return { ok: true }

  const msg =
    error?.message ??
    `Storage bucket "${ORGANIZATIONS_STORAGE_BUCKET}" could not be loaded`
  return { ok: false, message: msg }
}
