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

/**
 * A document that has been submitted for HR approval but whose `documents` /
 * `document_versions` rows have not yet been created.  The file already exists
 * in Supabase Storage; all metadata is sourced from `approval_items.new_value`.
 */
export type PendingDocumentItem = {
  /** approval_items.id — stable key for React lists. */
  approvalItemId: string
  requestId: string
  documentTypeId: string
  title: string
  fileName: string | null
  fileSize: number | null
  fileType: string | null
  /** Public URL already in storage (available for preview). */
  fileUrl: string | null
  issueDate: string | null
  expiryDate: string | null
  uploadedAt: string | null
}

/** Full payload returned to the API route and forwarded to the client. */
export type EmployeeDocumentsTabPayload = {
  documentTypes: DocumentTypeTabItem[]
  /** Flat list of all current-version cards; client groups by `documentTypeId`. */
  versionCards: DocumentVersionCard[]
  /**
   * Pending document approval items — submitted but awaiting HR review.
   * These have no `documents` / `document_versions` rows yet.
   */
  pendingDocumentItems: PendingDocumentItem[]
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

  // Build approved version cards (skip entirely when there are no types)
  const versionCards: DocumentVersionCard[] = []

  if (typeIds.length > 0) {
    const { data: rawDocs, error: docsError } = await supabase
      .from('documents')
      .select('id, document_type_id, title, issue_date, expiry_date, current_version_id')
      .eq('employee_id', employeeId)
      .eq('organization_id', orgId)
      .in('document_type_id', typeIds)

    if (docsError) {
      console.error('[employee-documents-tab] Failed to fetch documents:', docsError)
      // Fall through with empty versionCards; pending items query still runs below.
    } else {
      const docs = (rawDocs ?? []) as RawDocument[]
      const currentVersionIds = docs
        .map((d) => d.current_version_id)
        .filter((id): id is string => !!id)

      if (currentVersionIds.length > 0) {
        const { data: rawVersions, error: versionsError } = await supabase
          .from('document_versions')
          .select('id, document_id, file_name, file_type, file_size, file_url, storage_object_path, uploaded_at')
          .in('id', currentVersionIds)

        if (versionsError) {
          console.error('[employee-documents-tab] Failed to fetch versions:', versionsError)
          // Fall through with empty versionCards.
        } else {
          const versions = (rawVersions ?? []) as RawDocumentVersion[]
          const versionById = new Map(versions.map((v) => [v.id, v]))

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
        }
      }
    }
  }

  // ── Pending document approval items ────────────────────────────────────────
  // When an employee submits documents via the ESS profile-update form, we
  // immediately insert document_versions (status = 'pending') + a documents
  // row where needed, then create an approval_items row that references the
  // version via document_version_id.
  //
  // We read the real document_versions row here for accuracy — no need to parse
  // the JSON snapshot in new_value.
  const pendingDocumentItems: PendingDocumentItem[] = []

  const { data: openRequests } = await supabase
    .from('approval_requests')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('organization_id', orgId)
    .eq('request_type', 'PROFILE_UPDATE')
    .in('status', ['pending', 'partially_approved'])

  const openRequestIds = ((openRequests ?? []) as Array<{ id: string }>).map((r) => r.id)

  if (openRequestIds.length > 0) {
    // Three flat queries joined in-memory — avoids PostgREST nested-embed
    // ambiguity when traversing approval_items → document_versions → documents.

    // 1. Pending DOCUMENT items that have a linked version.
    const { data: rawItems } = await supabase
      .from('approval_items')
      .select('id, request_id, document_version_id')
      .in('request_id', openRequestIds)
      .eq('item_type', 'DOCUMENT')
      .eq('status', 'pending')
      .not('document_version_id', 'is', null)

    type RawApprovalItem = {
      id: string
      request_id: string
      document_version_id: string
    }

    const items = (rawItems ?? []) as RawApprovalItem[]
    if (items.length === 0) {
      return { documentTypes, versionCards, pendingDocumentItems }
    }

    const versionIds = items.map((i) => i.document_version_id)

    // 2. The document_versions rows for those items.
    const { data: rawVersions } = await supabase
      .from('document_versions')
      .select('id, document_id, file_name, file_size, file_type, file_url, uploaded_at')
      .in('id', versionIds)

    type RawPendingVersion = {
      id: string
      document_id: string
      file_name: string | null
      file_size: number | null
      file_type: string | null
      file_url: string | null
      uploaded_at: string
    }

    const versionById = new Map(
      ((rawVersions ?? []) as RawPendingVersion[]).map((v) => [v.id, v]),
    )

    const documentIds = [...new Set(
      ((rawVersions ?? []) as RawPendingVersion[]).map((v) => v.document_id),
    )]

    // 3. The parent documents rows.
    const { data: rawDocs } = await supabase
      .from('documents')
      .select('id, title, document_type_id, issue_date, expiry_date')
      .in('id', documentIds)

    type RawPendingDoc = {
      id: string
      title: string
      document_type_id: string
      issue_date: string | null
      expiry_date: string | null
    }

    const docById = new Map(
      ((rawDocs ?? []) as RawPendingDoc[]).map((d) => [d.id, d]),
    )

    // Join in-memory and build the result list.
    for (const item of items) {
      const ver = versionById.get(item.document_version_id)
      if (!ver) continue
      const doc = docById.get(ver.document_id)
      if (!doc) continue

      pendingDocumentItems.push({
        approvalItemId: item.id,
        requestId: item.request_id,
        documentTypeId: doc.document_type_id,
        title: doc.title,
        fileName: ver.file_name,
        fileSize: ver.file_size,
        fileType: ver.file_type,
        fileUrl: ver.file_url,
        issueDate: doc.issue_date,
        expiryDate: doc.expiry_date,
        uploadedAt: ver.uploaded_at,
      })
    }
  }

  return { documentTypes, versionCards, pendingDocumentItems }
}
