import { AVATAR_EXT_MAP } from './constants'

/**
 * Object key inside the `organizations` bucket for an employee profile avatar.
 *
 * Format: `{orgId}/employees/{employeeId}/profile/avatar.{ext}`
 *
 * Path segments are created implicitly on first `upload` (no separate mkdir).
 * Re-uploads use `upsert: true` so the same key is replaced.
 */
export function buildAvatarObjectPath(
  orgId: string,
  employeeId: string,
  mimeType: string,
): string {
  const ext = AVATAR_EXT_MAP[mimeType] ?? 'jpg'
  return `${orgId}/employees/${employeeId}/profile/avatar.${ext}`
}
