import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  DOCUMENT_ALLOWED_MIME,
  DOCUMENT_MAX_BYTES,
} from '@/lib/document-upload/constants'
import { buildDocumentObjectPath } from '@/lib/document-upload/path'
import { ensureOrganizationsBucket } from '@/lib/avatar-upload/ensure-bucket'
import type { DocumentVersionCard } from '@/lib/data/employee-documents-tab'

export const runtime = 'nodejs'

// ─── Response helpers ─────────────────────────────────────────────────────────

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

// ─── POST /api/employees/[id]/documents/upload ────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: employeeId } = await params

  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('Unauthorized', 401)

  // ── 2. Resolve org ─────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) return err('Organization not found', 403)

  const orgId = profile.organization_id as string

  // ── 3. Verify employee belongs to the caller's org ─────────────────────────
  const { data: employee } = await supabase
    .from('employees')
    .select('id')
    .eq('id', employeeId)
    .eq('organization_id', orgId)
    .single()
  if (!employee) return err('Employee not found', 404)

  // ── 4. Parse multipart form data ───────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return err('Invalid multipart form data', 400)
  }

  const file = formData.get('file')
  if (!(file instanceof File)) return err('No file provided', 400)

  const documentTypeId = formData.get('documentTypeId')
  if (typeof documentTypeId !== 'string' || !documentTypeId)
    return err('documentTypeId is required', 400)

  const title = formData.get('title')
  if (typeof title !== 'string' || !title.trim())
    return err('title is required', 400)

  const issueDate = formData.get('issueDate')
  const expiryDate = formData.get('expiryDate')

  // ── 5. Validate file ───────────────────────────────────────────────────────
  if (!DOCUMENT_ALLOWED_MIME.has(file.type as never)) {
    return err('Only PDF, DOCX, PNG, JPEG, and JPG files are allowed', 400)
  }
  if (file.size > DOCUMENT_MAX_BYTES) {
    return err('File must not exceed 50 MB', 400)
  }

  // ── 6. Validate documentTypeId belongs to org (USER type only) ─────────────
  const { data: docType } = await supabase
    .from('document_types')
    .select('id, owner_type, allow_multiple')
    .eq('id', documentTypeId)
    .eq('owner_type', 'USER')
    .or(`organization_id.eq.${orgId},organization_id.is.null`)
    .single()
  if (!docType) return err('Document type not found or not accessible', 404)

  // Coerce allow_multiple — some drivers / caches can surface non-boolean values.
  const rawAllowMultiple = (docType as { allow_multiple?: unknown }).allow_multiple
  const allowMultiple =
    rawAllowMultiple === true ||
    rawAllowMultiple === 1 ||
    (typeof rawAllowMultiple === 'string' &&
      ['true', 't', '1', 'yes'].includes(rawAllowMultiple.toLowerCase()))

  // ── 7. Admin client + bucket check (needed for replacement lookup + upload) ─
  const admin = createAdminClient()
  const bucketReady = await ensureOrganizationsBucket(admin)
  if (!bucketReady.ok) {
    console.error('[document-upload] bucket check failed:', bucketReady.message)
    return err(`Storage is not available: ${bucketReady.message}`, 503)
  }

  // When allow_multiple is false, at most one documents row per employee+type.
  // Re-uploads append a new document_versions row and bump current_version_id;
  // the previous version row stays in the DB but its storage object is removed.
  type ReplaceMode = {
    kind: 'replace'
    documentId: string
    /** Storage path for the file that was current before this upload (may be null). */
    oldStoragePath: string | null
  }
  type NewMode = { kind: 'new' }
  let mode: ReplaceMode | NewMode = { kind: 'new' }

  if (!allowMultiple) {
    const { data: existing } = await admin
      .from('documents')
      .select('id, current_version_id')
      .eq('employee_id', employeeId)
      .eq('organization_id', orgId)
      .eq('document_type_id', documentTypeId)
      .maybeSingle()

    if (existing) {
      let oldStoragePath: string | null = null
      if (existing.current_version_id) {
        const { data: oldVer } = await admin
          .from('document_versions')
          .select('storage_object_path')
          .eq('id', existing.current_version_id as string)
          .eq('document_id', existing.id as string)
          .maybeSingle()
        oldStoragePath = (oldVer?.storage_object_path as string | null) ?? null
      }
      mode = {
        kind: 'replace',
        documentId: existing.id as string,
        oldStoragePath,
      }
    }
  }

  const documentId = mode.kind === 'replace' ? mode.documentId : crypto.randomUUID()
  const versionId = crypto.randomUUID()
  const objectPath = buildDocumentObjectPath(orgId, employeeId, documentId, versionId, file.type)

  // ── 8. Upload file to Supabase Storage ─────────────────────────────────────
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from('organizations')
    .upload(objectPath, buffer, {
      contentType: file.type,
      upsert: false, // each version is a unique path — never overwrite
      cacheControl: '3600',
    })

  if (uploadError) {
    const detail =
      typeof uploadError === 'object' && 'message' in uploadError
        ? String((uploadError as { message: string }).message)
        : JSON.stringify(uploadError)
    console.error('[document-upload] storage upload error:', uploadError)
    return err(`Storage upload failed: ${detail}`, 502)
  }

  // ── 9. Compute public URL ─────────────────────────────────────────────────
  const { data: urlData } = admin.storage.from('organizations').getPublicUrl(objectPath)
  const fileUrl = urlData.publicUrl

  const now = new Date().toISOString()

  const issueDateVal =
    issueDate && typeof issueDate === 'string' && issueDate ? issueDate : null
  const expiryDateVal =
    expiryDate && typeof expiryDate === 'string' && expiryDate ? expiryDate : null

  // ── 10. Persist DB: either new document + v1, or new version on existing doc ─
  if (mode.kind === 'replace') {
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
    const nextVersion = Number.isFinite(prevNum) ? prevNum + 1 : 1

    const { error: versionInsertError } = await admin.from('document_versions').insert({
      id: versionId,
      organization_id: orgId,
      document_id: documentId,
      file_url: fileUrl,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      version: nextVersion,
      status: 'approved',
      uploaded_by: user.id,
      uploaded_at: now,
      storage_object_path: objectPath,
    })

    if (versionInsertError) {
      console.error('[document-upload] document_versions insert failed:', versionInsertError)
      await admin.storage.from('organizations').remove([objectPath]).catch(() => null)
      return err(`Failed to create document version: ${versionInsertError.message}`, 502)
    }

    const { error: docUpdateError } = await admin
      .from('documents')
      .update({
        current_version_id: versionId,
        title: title.trim(),
        issue_date: issueDateVal,
        expiry_date: expiryDateVal,
        status: 'approved',
      })
      .eq('id', documentId)
      .eq('organization_id', orgId)
      .eq('employee_id', employeeId)

    if (docUpdateError) {
      console.error('[document-upload] documents update failed:', docUpdateError)
      await Promise.allSettled([
        admin.from('document_versions').delete().eq('id', versionId),
        admin.storage.from('organizations').remove([objectPath]),
      ])
      return err(`Failed to update document: ${docUpdateError.message}`, 502)
    }

    // Remove prior current file from storage only — keep old document_versions row.
    if (mode.oldStoragePath && mode.oldStoragePath !== objectPath) {
      const { error: removeOldError } = await admin.storage
        .from('organizations')
        .remove([mode.oldStoragePath])
      if (removeOldError) {
        console.error('[document-upload] failed to remove superseded storage object:', removeOldError)
      }
    }
  } else {
    const { error: docInsertError } = await admin
      .from('documents')
      .insert({
        id: documentId,
        organization_id: orgId,
        employee_id: employeeId,
        document_type_id: documentTypeId,
        title: title.trim(),
        issue_date: issueDateVal,
        expiry_date: expiryDateVal,
        status: 'approved',
        owner_type: 'USER',
        created_at: now,
      })

    if (docInsertError) {
      console.error('[document-upload] documents insert failed:', docInsertError)
      await admin.storage.from('organizations').remove([objectPath]).catch(() => null)
      return err(`Failed to create document record: ${docInsertError.message}`, 502)
    }

    const { error: versionInsertError } = await admin
      .from('document_versions')
      .insert({
        id: versionId,
        organization_id: orgId,
        document_id: documentId,
        file_url: fileUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        version: 1,
        status: 'approved',
        uploaded_by: user.id,
        uploaded_at: now,
        storage_object_path: objectPath,
      })

    if (versionInsertError) {
      console.error('[document-upload] document_versions insert failed:', versionInsertError)
      await Promise.allSettled([
        admin.from('documents').delete().eq('id', documentId),
        admin.storage.from('organizations').remove([objectPath]),
      ])
      return err(`Failed to create document version: ${versionInsertError.message}`, 502)
    }

    const { error: updateError } = await admin
      .from('documents')
      .update({ current_version_id: versionId })
      .eq('id', documentId)

    if (updateError) {
      console.error('[document-upload] current_version_id update failed:', updateError)
    }
  }

  // ── 11. Return the new version card so the UI can append it immediately ─────
  const card: DocumentVersionCard = {
    versionId,
    documentId,
    documentTypeId,
    title: title.trim(),
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    fileUrl,
    storageObjectPath: objectPath,
    uploadedAt: now,
    issueDate: issueDate && typeof issueDate === 'string' && issueDate ? issueDate : null,
    expiryDate: expiryDate && typeof expiryDate === 'string' && expiryDate ? expiryDate : null,
  }

  return NextResponse.json({ card })
}
