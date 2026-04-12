/**
 * Employee document upload constants.
 *
 * Documents live inside the shared `organizations` bucket — the same bucket
 * used for profile avatars.  The object key format is:
 *   {orgId}/employees/{employeeId}/documents/{documentId}/versions/{versionId}.{ext}
 */

export const DOCUMENT_MAX_BYTES = 50 * 1024 * 1024 // 50 MB

/** MIME types accepted for employee document uploads. */
export const DOCUMENT_ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/jpg',
] as const)

export type DocumentMimeType =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'image/png'
  | 'image/jpeg'
  | 'image/jpg'

/** MIME → canonical file extension. */
export const DOCUMENT_EXT_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/png':  'png',
  'image/jpeg': 'jpg',
  'image/jpg':  'jpg',
}
