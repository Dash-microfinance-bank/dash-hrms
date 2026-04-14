import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEssContext, getCurrentEmployeeProfileForEss } from '@/lib/data/employee-profile'
import { getEmployeeProfileSchema } from '@/lib/data/employee-permissions'
import {
  DOCUMENT_ALLOWED_MIME,
  DOCUMENT_MAX_BYTES,
} from '@/lib/document-upload/constants'
import { buildDocumentObjectPath } from '@/lib/document-upload/path'
import { ensureOrganizationsBucket } from '@/lib/avatar-upload/ensure-bucket'

export const runtime = 'nodejs'

// ─── Response helpers ─────────────────────────────────────────────────────────

function ok(data: Record<string, unknown>) {
  return NextResponse.json(data)
}

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

// ─── Payload types ────────────────────────────────────────────────────────────

type RecordCreateTable =
  | 'employee_family'
  | 'employee_dependants'
  | 'employee_next_of_kin'
  | 'employee_experience'
  | 'employee_education'
  | 'employee_training'

type RecordCreateRequest = {
  table: RecordCreateTable
  payload: Record<string, unknown>
}

type DocumentMetaItem = {
  clientId: string
  documentTypeId: string
  title: string
  issueDate: string | null
  expiryDate: string | null
}

/**
 * Validated + uploaded document ready for DB insertion.
 * Provisional IDs are generated before storage upload so the storage path is
 * stable even if subsequent DB writes fail and need to be retried.
 */
type StagedDocument = {
  provisionalDocumentId: string
  provisionalVersionId: string
  objectPath: string
  fileUrl: string
  documentTypeId: string
  docTypeName: string
  /** Coerced boolean, drives whether to reuse an existing documents row. */
  allowMultiple: boolean
  title: string
  fileName: string
  fileSize: number
  fileType: string
  issueDate: string | null
  expiryDate: string | null
}

/**
 * After documents + document_versions rows are written to DB.
 * Used to build the approval_items rows and to roll back on failure.
 */
type InsertedVersion = {
  versionId: string
  /** The documents row this version belongs to. */
  documentId: string
  /** True when we created a new documents row (must be rolled back on failure). */
  newDocumentsRow: boolean
  objectPath: string
  documentTypeId: string
  docTypeName: string
  title: string
  fileName: string
  fileSize: number
  fileType: string
  issueDate: string | null
  expiryDate: string | null
}

// ─── Permissions / validation constants ──────────────────────────────────────

const SINGLE_RECORD_GROUPS = new Set([
  'Personal Information',
  'Contact Information',
  'Address Information',
  'Financial Information',
  'Emergency Contacts',
])

const RECORD_CREATE_CONFIG: Record<
  RecordCreateTable,
  { fieldGroup: string; requiredKeys: string[]; allowedKeys: string[] }
> = {
  employee_family: {
    fieldGroup: 'Family',
    requiredKeys: ['title', 'first_name', 'last_name', 'phone', 'relationship', 'address'],
    allowedKeys: ['title', 'first_name', 'last_name', 'phone', 'email', 'relationship', 'address'],
  },
  employee_dependants: {
    fieldGroup: 'Dependants',
    requiredKeys: ['title', 'first_name', 'last_name', 'phone', 'relationship', 'address'],
    allowedKeys: ['title', 'first_name', 'last_name', 'phone', 'email', 'relationship', 'address'],
  },
  employee_next_of_kin: {
    fieldGroup: 'Next of Kin',
    requiredKeys: ['title', 'first_name', 'last_name', 'phone', 'relationship', 'purpose', 'address'],
    allowedKeys: ['title', 'first_name', 'last_name', 'phone', 'email', 'relationship', 'purpose', 'address'],
  },
  employee_experience: {
    fieldGroup: 'Work Experience',
    requiredKeys: ['company', 'position', 'address', 'start_date'],
    allowedKeys: ['company', 'position', 'address', 'phone', 'email', 'reason_for_leaving', 'start_date', 'end_date'],
  },
  employee_education: {
    fieldGroup: 'Education',
    requiredKeys: ['school', 'course', 'degree', 'start_date'],
    allowedKeys: ['school', 'course', 'degree', 'grade', 'start_date', 'end_date'],
  },
  employee_training: {
    fieldGroup: 'Training & Certifications',
    requiredKeys: ['institution', 'course', 'start_date'],
    allowedKeys: ['institution', 'course', 'license_name', 'issuing_body', 'start_date', 'end_date'],
  },
}

// ─── Rollback helpers ─────────────────────────────────────────────────────────

type AdminClient = ReturnType<typeof createAdminClient>

async function removeStorageObjects(admin: AdminClient, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await admin.storage.from('organizations').remove(paths).catch(() => null)
}

/**
 * Best-effort cleanup of DB rows inserted during this request before the route
 * returns an error. Operates with the admin client to bypass RLS.
 */
async function rollbackInsertedVersions(
  admin: AdminClient,
  versions: InsertedVersion[],
): Promise<void> {
  if (versions.length === 0) return
  await Promise.allSettled([
    // Remove version rows (they reference documents rows, so must go first)
    admin
      .from('document_versions')
      .delete()
      .in(
        'id',
        versions.map((v) => v.versionId),
      ),
    // Remove only the documents rows we created; existing ones must not be touched
    admin
      .from('documents')
      .delete()
      .in(
        'id',
        versions.filter((v) => v.newDocumentsRow).map((v) => v.documentId),
      ),
  ])
}

// ─── Route constants ──────────────────────────────────────────────────────────

const PROFILE_UPDATE_REQUEST_TYPE = 'PROFILE_UPDATE'
const PROFILE_UPDATE_REQUEST_SOURCE = 'ESS_PROFILE_FORM'

// ─── POST /api/profile-update-request ────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── 1. Auth + ESS context ──────────────────────────────────────────────────
  const ctx = await getEssContext()
  if ('error' in ctx) return err(ctx.error, 401)
  const { supabase, employeeId, orgId, userId } = ctx

  // ── 2. Parse multipart form data ───────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return err('Invalid form data', 400)
  }

  let changes: Record<string, unknown> = {}
  let recordCreates: RecordCreateRequest[] = []
  let documentMeta: DocumentMetaItem[] = []

  try {
    const changesRaw = formData.get('changes')
    const recordCreatesRaw = formData.get('recordCreates')
    const documentMetaRaw = formData.get('documentMeta')
    if (changesRaw && typeof changesRaw === 'string') changes = JSON.parse(changesRaw)
    if (recordCreatesRaw && typeof recordCreatesRaw === 'string')
      recordCreates = JSON.parse(recordCreatesRaw)
    if (documentMetaRaw && typeof documentMetaRaw === 'string')
      documentMeta = JSON.parse(documentMetaRaw)
  } catch {
    return err('Malformed JSON payload', 400)
  }

  const hasChanges = Object.keys(changes).length > 0
  const hasRecordCreates = recordCreates.length > 0
  const hasDocs = documentMeta.length > 0

  if (!hasChanges && !hasRecordCreates && !hasDocs) {
    return err('No changes provided', 400)
  }

  // ── 3. Match document File objects from form data ──────────────────────────
  const docFiles = new Map<string, File>()
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('doc_') && value instanceof File) {
      docFiles.set(key.slice(4), value) // strip 'doc_' prefix → clientId
    }
  }

  for (const meta of documentMeta) {
    if (!docFiles.has(meta.clientId)) {
      return err(`Missing file for queued document "${meta.title}"`, 400)
    }
  }

  // ── 4. Validate scalar field permissions ───────────────────────────────────
  type PermEntry = { can_read: boolean; can_write: boolean; group_name: string; label: string }
  const permMap = new Map<string, PermEntry>()

  if (hasChanges) {
    const schema = await getEmployeeProfileSchema()
    if (!schema) return err('Profile permissions not configured for your organization', 500)

    for (const [groupName, fields] of Object.entries(schema)) {
      for (const field of fields) {
        permMap.set(field.field_key, {
          can_read: field.can_read,
          can_write: field.can_write,
          group_name: groupName,
          label: field.label,
        })
      }
    }

    for (const fieldKey of Object.keys(changes)) {
      const perm = permMap.get(fieldKey)
      if (!perm) return err(`Unknown field: ${fieldKey}`, 400)
      if (!perm.can_read) return err(`Field "${fieldKey}" is not visible`, 403)
      if (!perm.can_write) return err(`Field "${fieldKey}" is not editable`, 403)
      if (!SINGLE_RECORD_GROUPS.has(perm.group_name)) {
        return err(`Field "${fieldKey}" cannot be updated via profile requests`, 400)
      }
    }
  }

  // ── 5. Validate record create payloads ─────────────────────────────────────
  for (const record of recordCreates) {
    const config = RECORD_CREATE_CONFIG[record.table]
    if (!config) return err(`Unsupported table: ${record.table}`, 400)

    for (const key of Object.keys(record.payload ?? {})) {
      if (!config.allowedKeys.includes(key)) {
        return err(`Field "${key}" is not allowed for ${config.fieldGroup}`, 400)
      }
    }

    for (const key of config.requiredKeys) {
      const value = record.payload?.[key]
      if (value === null || value === undefined || value === '') {
        return err(`${config.fieldGroup}: "${key}" is required`, 400)
      }
    }
  }

  // ── 6. Upload document files to Supabase Storage ──────────────────────────
  //
  // Storage upload happens BEFORE any DB writes so that if the upload fails we
  // have not partially modified the database. Provisional IDs are generated here
  // and carried forward into the DB insertion phase — the storage object path
  // is built from them and will not change.
  //
  const admin = createAdminClient()

  if (hasDocs) {
    const bucketReady = await ensureOrganizationsBucket(admin)
    if (!bucketReady.ok) return err(`Storage unavailable: ${bucketReady.message}`, 503)
  }

  const stagedDocs: StagedDocument[] = []

  for (const meta of documentMeta) {
    const file = docFiles.get(meta.clientId)!

    if (!DOCUMENT_ALLOWED_MIME.has(file.type as never)) {
      await removeStorageObjects(admin, stagedDocs.map((d) => d.objectPath))
      return err('Only PDF, DOCX, PNG, JPEG, and JPG files are allowed', 400)
    }
    if (file.size > DOCUMENT_MAX_BYTES) {
      await removeStorageObjects(admin, stagedDocs.map((d) => d.objectPath))
      return err(`"${file.name}" exceeds the 50 MB file size limit`, 400)
    }

    const { data: docType } = await admin
      .from('document_types')
      .select('id, name, allow_multiple')
      .eq('id', meta.documentTypeId)
      .eq('owner_type', 'USER')
      .or(`organization_id.eq.${orgId},organization_id.is.null`)
      .single()

    if (!docType) {
      await removeStorageObjects(admin, stagedDocs.map((d) => d.objectPath))
      return err('Document type not found or not accessible', 404)
    }

    // Coerce allow_multiple — the DB driver can surface non-boolean values.
    const rawAllowMultiple = (docType as { allow_multiple?: unknown }).allow_multiple
    const allowMultiple =
      rawAllowMultiple === true ||
      rawAllowMultiple === 1 ||
      (typeof rawAllowMultiple === 'string' &&
        ['true', 't', '1', 'yes'].includes(rawAllowMultiple.toLowerCase()))

    const provisionalDocumentId = crypto.randomUUID()
    const provisionalVersionId = crypto.randomUUID()
    const objectPath = buildDocumentObjectPath(
      orgId,
      employeeId,
      provisionalDocumentId,
      provisionalVersionId,
      file.type,
    )

    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await admin.storage
      .from('organizations')
      .upload(objectPath, buffer, { contentType: file.type, upsert: false, cacheControl: '3600' })

    if (uploadError) {
      await removeStorageObjects(admin, stagedDocs.map((d) => d.objectPath))
      return err(`Storage upload failed for "${file.name}": ${uploadError.message}`, 502)
    }

    const { data: urlData } = admin.storage.from('organizations').getPublicUrl(objectPath)

    stagedDocs.push({
      provisionalDocumentId,
      provisionalVersionId,
      objectPath,
      fileUrl: urlData.publicUrl,
      documentTypeId: meta.documentTypeId,
      docTypeName: (docType as { name: string }).name,
      allowMultiple,
      title: meta.title.trim(),
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      issueDate: meta.issueDate || null,
      expiryDate: meta.expiryDate || null,
    })
  }

  // ── 7. Canonical old-values for scalar changes ────────────────────────────
  const currentProfile: Record<string, unknown> = hasChanges
    ? ((await getCurrentEmployeeProfileForEss()) as Record<string, unknown> | null) ?? {}
    : {}

  // ── 8. Resolve / create the approval_request row ──────────────────────────
  //
  const { data: openRequests } = await supabase
    .from('approval_requests')
    .select('id, status')
    .eq('employee_id', employeeId)
    .eq('organization_id', orgId)
    .eq('request_type', PROFILE_UPDATE_REQUEST_TYPE)
    .in('status', ['pending', 'partially_approved'])
    .order('created_at', { ascending: false })
    .limit(1)

  type OpenRequest = { id: string; status: string }
  const existingRequest =
    (openRequests ?? []).length > 0 ? (openRequests![0] as OpenRequest) : null

  let reusableRequestId: string | null = null

  if (existingRequest) {
    if (existingRequest.status === 'pending') {
      reusableRequestId = existingRequest.id
    } else if (existingRequest.status === 'partially_approved') {
      const { data: pendingCheck } = await supabase
        .from('approval_items')
        .select('id')
        .eq('request_id', existingRequest.id)
        .eq('status', 'pending')
        .limit(1)
      if ((pendingCheck ?? []).length > 0) reusableRequestId = existingRequest.id
    }
  }

  // For a fresh request we need to guard against scalar field conflicts in other
  // open requests before creating the row.
  let newRequestCreated = false
  let requestId: string

  if (reusableRequestId) {
    requestId = reusableRequestId
  } else {
    if (hasChanges) {
      const { data: otherOpen } = await supabase
        .from('approval_requests')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('organization_id', orgId)
        .eq('request_type', PROFILE_UPDATE_REQUEST_TYPE)
        .in('status', ['pending', 'partially_approved'])

      if (otherOpen?.length) {
        const reqIds = (otherOpen as Array<{ id: string }>).map((r) => r.id)
        const { data: blockedItems } = await supabase
          .from('approval_items')
          .select('field_name')
          .in('request_id', reqIds)
          .eq('status', 'pending')
          .eq('item_type', 'FIELD')
          .in('field_name', Object.keys(changes))

        if (blockedItems?.length) {
          await removeStorageObjects(admin, stagedDocs.map((d) => d.objectPath))
          const blocked = (blockedItems as Array<{ field_name: string }>)
            .map((i) => {
              const p = permMap.get(i.field_name)
              return p ? p.label : i.field_name
            })
            .join(', ')
          return err(`These fields already have pending requests: ${blocked}`, 409)
        }
      }
    }

    const { data: newRequest, error: requestError } = await supabase
      .from('approval_requests')
      .insert({
        employee_id: employeeId,
        organization_id: orgId,
        status: 'pending',
        request_type: PROFILE_UPDATE_REQUEST_TYPE,
        source: PROFILE_UPDATE_REQUEST_SOURCE,
      })
      .select('id')
      .single()

    if (requestError || !newRequest) {
      await removeStorageObjects(admin, stagedDocs.map((d) => d.objectPath))
      return err(requestError?.message ?? 'Failed to create approval request', 500)
    }

    requestId = (newRequest as { id: string }).id
    newRequestCreated = true
  }

  // ── 9. Insert document_versions rows (status: pending) ────────────────────
  //
  // Strategy per document type:
  //
  //   allow_multiple = false, existing documents row found
  //     → attach the new version to the existing documents row.
  //       The documents row keeps its current status and current_version_id;
  //       only the approval handler updates those on approval.
  //
  //   allow_multiple = false, NO existing documents row
  //   allow_multiple = true (always a new upload)
  //     → insert a new documents row with status = 'pending'.
  //       The approval handler promotes it to 'approved'.
  //
  // In both cases a document_versions row is inserted with status = 'pending'.
  // The approval_items row then references the version via document_version_id.
  //
  const insertedVersions: InsertedVersion[] = []
  const now = new Date().toISOString()

  for (const doc of stagedDocs) {
    let documentId: string
    let newDocumentsRow = false

    if (!doc.allowMultiple) {
      // Look for an existing documents row for this employee + type.
      // We use maybeSingle() because there may be zero or one row.
      const { data: existing } = await admin
        .from('documents')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('organization_id', orgId)
        .eq('document_type_id', doc.documentTypeId)
        .maybeSingle()

      if (existing) {
        // Attach the new pending version to the already-existing documents row.
        documentId = existing.id as string
      } else {
        // First-time upload for this type — create a pending placeholder row.
        documentId = doc.provisionalDocumentId
        newDocumentsRow = true
      }
    } else {
      // allow_multiple = true: each upload is an independent document record.
      documentId = doc.provisionalDocumentId
      newDocumentsRow = true
    }

    // Insert the new documents row when required.
    if (newDocumentsRow) {
      const { error: docInsertErr } = await admin.from('documents').insert({
        id: documentId,
        organization_id: orgId,
        employee_id: employeeId,
        document_type_id: doc.documentTypeId,
        title: doc.title,
        issue_date: doc.issueDate,
        expiry_date: doc.expiryDate,
        status: 'pending',
        owner_type: 'USER',
        // profile_update_request_id intentionally omitted: its FK references
        // employee_profile_update_requests, not approval_requests. The link back
        // to the review cycle is already established via:
        //   approval_items.document_version_id → document_versions.document_id → documents.id
        // current_version_id deliberately left null — set on approval.
      })

      if (docInsertErr) {
        await Promise.allSettled([
          rollbackInsertedVersions(admin, insertedVersions),
          removeStorageObjects(admin, stagedDocs.map((d) => d.objectPath)),
          newRequestCreated
            ? supabase
                .from('approval_requests')
                .delete()
                .eq('id', requestId)
                .eq('request_type', PROFILE_UPDATE_REQUEST_TYPE)
            : Promise.resolve(),
        ])
        return err(`Failed to create document record: ${docInsertErr.message}`, 502)
      }
    }

    // Compute the next version number.
    // For allow_multiple=false with an existing documents row we query the max
    // version already in that document's history; for all other cases version = 1.
    let nextVersion = 1
    if (!newDocumentsRow) {
      const { data: maxRow } = await admin
        .from('document_versions')
        .select('version')
        .eq('document_id', documentId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()

      const prevNum =
        typeof maxRow?.version === 'number'
          ? maxRow.version
          : typeof maxRow?.version === 'string'
            ? Number.parseInt(maxRow.version, 10)
            : Number.NaN
      nextVersion = Number.isFinite(prevNum) ? prevNum + 1 : 1
    }

    const { error: versionInsertErr } = await admin.from('document_versions').insert({
      id: doc.provisionalVersionId,
      organization_id: orgId,
      document_id: documentId,
      file_url: doc.fileUrl,
      file_name: doc.fileName,
      file_size: doc.fileSize,
      file_type: doc.fileType,
      version: nextVersion,
      status: 'pending',
      uploaded_by: userId,
      uploaded_at: now,
      storage_object_path: doc.objectPath,
    })

    if (versionInsertErr) {
      // Roll back the documents row we just created (if any), prior versions,
      // uploaded storage objects, and the request if we created it this cycle.
      if (newDocumentsRow) {
        await admin.from('documents').delete().eq('id', documentId).then(() => null, () => null)
      }
      await Promise.allSettled([
        rollbackInsertedVersions(admin, insertedVersions),
        removeStorageObjects(admin, stagedDocs.map((d) => d.objectPath)),
        newRequestCreated
          ? supabase
              .from('approval_requests')
              .delete()
              .eq('id', requestId)
              .eq('request_type', PROFILE_UPDATE_REQUEST_TYPE)
          : Promise.resolve(),
      ])
      return err(`Failed to create document version: ${versionInsertErr.message}`, 502)
    }

    insertedVersions.push({
      versionId: doc.provisionalVersionId,
      documentId,
      newDocumentsRow,
      objectPath: doc.objectPath,
      documentTypeId: doc.documentTypeId,
      docTypeName: doc.docTypeName,
      title: doc.title,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      fileType: doc.fileType,
      issueDate: doc.issueDate,
      expiryDate: doc.expiryDate,
    })
  }

  // ── 10. Build and insert approval_items ───────────────────────────────────
  //
  // FIELD items:  scalar field diffs and record-create requests.
  // DOCUMENT items: one row per inserted version, with:
  //   - document_version_id → the real document_versions.id just inserted
  //   - target_row_id       → the documents.id (existing or newly created)
  //   - new_value           → human-readable snapshot for HR review UI
  //
  // DOCUMENT items use operation = 'create_record' which is the only valid enum
  // value that fits; item_type = 'DOCUMENT' distinguishes them from ordinary
  // record creates in the approval handler.
  //
  const buildDocumentItems = (reqId: string) =>
    insertedVersions.map((ver) => ({
      request_id: reqId,
      organization_id: orgId,
      item_type: 'DOCUMENT' as const,
      document_version_id: ver.versionId,
      field_name: `document.${ver.documentTypeId}`,
      field_group: 'Documents',
      old_value: null,
      new_value: {
        documentTypeId: ver.documentTypeId,
        documentTypeName: ver.docTypeName,
        documentId: ver.documentId,
        versionId: ver.versionId,
        title: ver.title,
        fileName: ver.fileName,
        fileSize: ver.fileSize,
        fileType: ver.fileType,
        issueDate: ver.issueDate,
        expiryDate: ver.expiryDate,
        uploadedAt: now,
      },
      status: 'pending' as const,
      operation: 'create_record' as const,
      target_table: 'documents' as string | null,
      target_row_id: ver.documentId as string | null,
    }))

  // Helper shared by both reuse and new-request paths.
  const rollbackAll = async () => {
    await Promise.allSettled([
      rollbackInsertedVersions(admin, insertedVersions),
      removeStorageObjects(admin, insertedVersions.map((v) => v.objectPath)),
      newRequestCreated
        ? supabase
            .from('approval_requests')
            .delete()
            .eq('id', requestId)
            .eq('request_type', PROFILE_UPDATE_REQUEST_TYPE)
        : Promise.resolve(),
    ])
  }

  if (reusableRequestId) {
    // Dedup: skip scalar fields that already have a pending FIELD item on this request.
    const { data: existingPendingItems } = await supabase
      .from('approval_items')
      .select('field_name')
      .eq('request_id', requestId)
      .eq('status', 'pending')
      .eq('operation', 'field_update')
      .eq('item_type', 'FIELD')

    const alreadyPendingFields = new Set(
      ((existingPendingItems ?? []) as Array<{ field_name: string }>).map((r) => r.field_name),
    )

    const filteredScalarEntries = Object.entries(changes).filter(
      ([fieldKey]) => !alreadyPendingFields.has(fieldKey),
    )

    const scalarItems = filteredScalarEntries.map(([fieldKey, newVal]) => {
      const perm = permMap.get(fieldKey)!
      return {
        request_id: requestId,
        organization_id: orgId,
        item_type: 'FIELD' as const,
        document_version_id: null as string | null,
        field_name: fieldKey,
        field_group: perm.group_name,
        old_value:
          currentProfile[fieldKey] !== undefined ? { value: currentProfile[fieldKey] } : null,
        new_value: { value: newVal },
        status: 'pending' as const,
        operation: 'field_update' as const,
        target_table: null as string | null,
        target_row_id: null as string | null,
      }
    })

    const recordItems = recordCreates.map((record) => ({
      request_id: requestId,
      organization_id: orgId,
      item_type: 'FIELD' as const,
      document_version_id: null as string | null,
      field_name: `${record.table}.create`,
      field_group: RECORD_CREATE_CONFIG[record.table].fieldGroup,
      old_value: null,
      new_value: record.payload,
      status: 'pending' as const,
      operation: 'create_record' as const,
      target_table: record.table as string | null,
      target_row_id: null as string | null,
    }))

    const documentItems = buildDocumentItems(requestId)
    const items = [...scalarItems, ...recordItems, ...documentItems]

    if (items.length === 0) {
      // All scalars were already pending; document versions were still inserted.
      return ok({ success: true, requestId })
    }

    const { error: itemsError } = await supabase.from('approval_items').insert(items)
    if (itemsError) {
      await rollbackAll()
      return err(itemsError.message, 500)
    }

    await supabase.from('audit_logs').insert({
      organization_id: orgId,
      actor_id: userId,
      action: 'employee_profile_update_requested',
      resource_type: 'profile_update_request',
      resource_id: requestId,
      new_value: {
        appended_scalar_count: scalarItems.length,
        appended_record_count: recordItems.length,
        appended_document_count: documentItems.length,
      },
    })
  } else {
    const scalarItems = Object.entries(changes).map(([fieldKey, newVal]) => {
      const perm = permMap.get(fieldKey)!
      return {
        request_id: requestId,
        organization_id: orgId,
        item_type: 'FIELD' as const,
        document_version_id: null as string | null,
        field_name: fieldKey,
        field_group: perm.group_name,
        old_value:
          currentProfile[fieldKey] !== undefined ? { value: currentProfile[fieldKey] } : null,
        new_value: { value: newVal },
        status: 'pending' as const,
        operation: 'field_update' as const,
        target_table: null as string | null,
        target_row_id: null as string | null,
      }
    })

    const recordItems = recordCreates.map((record) => ({
      request_id: requestId,
      organization_id: orgId,
      item_type: 'FIELD' as const,
      document_version_id: null as string | null,
      field_name: `${record.table}.create`,
      field_group: RECORD_CREATE_CONFIG[record.table].fieldGroup,
      old_value: null,
      new_value: record.payload,
      status: 'pending' as const,
      operation: 'create_record' as const,
      target_table: record.table as string | null,
      target_row_id: null as string | null,
    }))

    const documentItems = buildDocumentItems(requestId)
    const items = [...scalarItems, ...recordItems, ...documentItems]

    const { error: itemsError } = await supabase.from('approval_items').insert(items)

    if (itemsError) {
      await rollbackAll()
      return err(itemsError.message, 500)
    }

    await supabase.from('audit_logs').insert({
      organization_id: orgId,
      actor_id: userId,
      action: 'employee_profile_update_requested',
      resource_type: 'profile_update_request',
      resource_id: requestId,
      new_value: {
        scalar_count: scalarItems.length,
        record_create_count: recordItems.length,
        document_count: documentItems.length,
      },
    })
  }

  // ── 11. Revalidate and respond ─────────────────────────────────────────────
  revalidatePath('/dashboard/profile-update-request')

  return ok({ success: true, requestId })
}
