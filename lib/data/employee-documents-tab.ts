'use server'

import { createClient } from '@/lib/supabase/server'

// ─── DTOs ─────────────────────────────────────────────────────────────────────

/** Slim document type descriptor for the 360 documents tab. */
export type DocumentTypeTabItem = {
  id: string
  name: string
  is_required: boolean
  allow_multiple: boolean
}

/** A single uploaded file card derived from one `document_versions` row. */
export type DocumentVersionCard = {
  versionId: string
  documentId: string
  documentTypeId: string
  /** User-supplied title on the parent `documents` row. */
  title: string
  /** Original filename as stored in `document_versions.file_name`. */
  fileName: string | null
  /** MIME type, e.g. "application/pdf" */
  fileType: string | null
  /** Byte size. Null if not stored. */
  fileSize: number | null
  /** Public URL to the stored file (used for inline view). */
  fileUrl: string | null
  /** Storage object path relative to the bucket root (used server-side for delete/download). */
  storageObjectPath: string | null
  /** ISO date string of when the version was uploaded. */
  uploadedAt: string
  /** Optional issue date on the parent `documents` row. */
  issueDate: string | null
  /** Optional expiry date on the parent `documents` row. */
  expiryDate: string | null
}

/** Full payload returned to the API route and forwarded to the client. */
export type EmployeeDocumentsTabPayload = {
  documentTypes: DocumentTypeTabItem[]
  /** Flat list of all current-version cards; client groups by `documentTypeId`. */
  versionCards: DocumentVersionCard[]
}

// ─── Raw DB row shapes ────────────────────────────────────────────────────────

type RawDocumentType = {
  id: string
  name: string
  required: boolean
  allow_multiple: boolean | null
}

type RawDocument = {
  id: string
  document_type_id: string
  title: string
  issue_date: string | null
  expiry_date: string | null
  current_version_id: string | null
}

type RawDocumentVersion = {
  id: string
  document_id: string
  file_name: string | null
  file_type: string | null
  file_size: number | null
  file_url: string | null
  storage_object_path: string | null
  uploaded_at: string
}

// ─── Data fetcher ─────────────────────────────────────────────────────────────

/**
 * Fetches all USER-owned document types for the org alongside this employee's
 * uploaded documents (current version only), all scoped to the caller's org.
 *
 * Returns null when the caller is unauthenticated, the org cannot be resolved,
 * or the target employee does not belong to the caller's org.
 */
export async function getEmployeeDocumentsTabData(
  employeeId: string,
): Promise<EmployeeDocumentsTabPayload | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Resolve the caller's organization (multi-tenancy anchor).
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) return null

  const orgId = profile.organization_id as string

  // Guard: the target employee must belong to the same org.
  const { data: employee } = await supabase
    .from('employees')
    .select('id')
    .eq('id', employeeId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!employee) return null

  // Fetch USER-owned document types for this org and system defaults (null org).
  const { data: rawTypes, error: typesError } = await supabase
    .from('document_types')
    .select('id, name, required, allow_multiple')
    .eq('owner_type', 'USER')
    .or(`organization_id.eq.${orgId},organization_id.is.null`)
    .order('name', { ascending: true })

  if (typesError) {
    console.error('[employee-documents-tab] Failed to fetch document types:', typesError)
    return null
  }

  const types = (rawTypes ?? []) as RawDocumentType[]
  const typeIds = types.map((t) => t.id)

  const documentTypes: DocumentTypeTabItem[] = types.map((t) => ({
    id: t.id,
    name: t.name,
    is_required: t.required,
    allow_multiple: t.allow_multiple ?? false,
  }))

  if (typeIds.length === 0) {
    return { documentTypes, versionCards: [] }
  }

  // Fetch documents owned by this employee for the above type ids.
  const { data: rawDocs, error: docsError } = await supabase
    .from('documents')
    .select('id, document_type_id, title, issue_date, expiry_date, current_version_id')
    .eq('employee_id', employeeId)
    .eq('organization_id', orgId)
    .in('document_type_id', typeIds)

  if (docsError) {
    console.error('[employee-documents-tab] Failed to fetch documents:', docsError)
    return { documentTypes, versionCards: [] }
  }

  const docs = (rawDocs ?? []) as RawDocument[]

  // Collect the current version ids that are actually set.
  const currentVersionIds = docs
    .map((d) => d.current_version_id)
    .filter((id): id is string => !!id)

  if (currentVersionIds.length === 0) {
    return { documentTypes, versionCards: [] }
  }

  // Fetch the current versions in one query.
  const { data: rawVersions, error: versionsError } = await supabase
    .from('document_versions')
    .select('id, document_id, file_name, file_type, file_size, file_url, storage_object_path, uploaded_at')
    .in('id', currentVersionIds)

  if (versionsError) {
    console.error('[employee-documents-tab] Failed to fetch versions:', versionsError)
    return { documentTypes, versionCards: [] }
  }

  const versions = (rawVersions ?? []) as RawDocumentVersion[]

  // Index versions and documents for O(1) lookups.
  const versionById = new Map(versions.map((v) => [v.id, v]))
  const docById = new Map(docs.map((d) => [d.id, d]))

  const versionCards: DocumentVersionCard[] = []

  for (const doc of docs) {
    if (!doc.current_version_id) continue
    const ver = versionById.get(doc.current_version_id)
    if (!ver) continue

    versionCards.push({
      versionId: ver.id,
      documentId: doc.id,
      documentTypeId: doc.document_type_id,
      title: doc.title,
      fileName: ver.file_name,
      fileType: ver.file_type,
      fileSize: ver.file_size,
      fileUrl: ver.file_url,
      storageObjectPath: ver.storage_object_path,
      uploadedAt: ver.uploaded_at,
      issueDate: doc.issue_date,
      expiryDate: doc.expiry_date,
    })
  }

  // Suppress unused variable warning — docById is available for future use.
  void docById

  return { documentTypes, versionCards }
}
