/**
 * Shared org-scoped Storage bucket (already provisioned in Supabase).
 * Avatar objects live at: `{orgId}/employees/{employeeId}/profile/avatar.{ext}`
 */
export const ORGANIZATIONS_STORAGE_BUCKET = 'organizations'

/** 10 MB expressed in bytes. */
export const AVATAR_MAX_BYTES = 10 * 1024 * 1024

/** Accepted MIME types for avatars. */
export const AVATAR_ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
] as const)

export type AvatarMimeType = 'image/jpeg' | 'image/jpg' | 'image/png'

/** Map from MIME → canonical file extension. */
export const AVATAR_EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg':  'jpg',
  'image/png':  'png',
}
