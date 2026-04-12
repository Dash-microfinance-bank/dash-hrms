import { DOCUMENT_EXT_MAP } from './constants'

/**
 * Object key inside the `organizations` bucket for an employee document version.
 *
 * Format: `{orgId}/employees/{employeeId}/documents/{documentId}/versions/{versionId}.{ext}`
 *
 * Path segments are virtual directories — they are created implicitly on first
 * upload; no separate "mkdir" step is needed.  Each version has a unique key,
 * so `upsert: false` is fine (the route generates fresh UUIDs per upload).
 */
export function buildDocumentObjectPath(
  orgId: string,
  employeeId: string,
  documentId: string,
  versionId: string,
  mimeType: string,
): string {
  const ext = DOCUMENT_EXT_MAP[mimeType] ?? 'bin'
  return `${orgId}/employees/${employeeId}/documents/${documentId}/versions/${versionId}.${ext}`
}
