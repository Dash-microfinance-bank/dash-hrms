import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

// ─── DELETE /api/employees/[id]/documents/[documentId] ────────────────────────
//
// Permanently deletes:
//   1. All storage objects for every version of this document
//   2. All document_versions rows
//   3. The documents row
//
// Multi-tenancy is enforced at every step: the document must belong to the
// caller's org AND to the given employee.

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const { id: employeeId, documentId } = await params

  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('Unauthorized', 401)

  // ── 2. Resolve org ───────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) return err('Organization not found', 403)

  const orgId = profile.organization_id as string

  // ── 3. Verify the document exists and belongs to this employee + org ─────────
  const { data: doc } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .eq('employee_id', employeeId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!doc) return err('Document not found', 404)

  // ── 4. Fetch all versions to collect storage paths ───────────────────────────
  const admin = createAdminClient()

  const { data: versions } = await admin
    .from('document_versions')
    .select('id, storage_object_path')
    .eq('document_id', documentId)

  // ── 5. Remove all storage objects (best-effort; log failures but don't abort) ─
  const storagePaths = (versions ?? [])
    .map((v) => v.storage_object_path as string | null)
    .filter((p): p is string => !!p)

  if (storagePaths.length > 0) {
    const { error: storageError } = await admin.storage
      .from('organizations')
      .remove(storagePaths)

    if (storageError) {
      console.error('[document-delete] storage remove error:', storageError)
      // Continue — stale storage objects are less critical than consistent DB state.
    }
  }

  // ── 6. Delete document_versions (cascade may handle this, but be explicit) ───
  if ((versions ?? []).length > 0) {
    const versionIds = (versions ?? []).map((v) => v.id as string)
    const { error: versionsDeleteError } = await admin
      .from('document_versions')
      .delete()
      .in('id', versionIds)

    if (versionsDeleteError) {
      console.error('[document-delete] document_versions delete error:', versionsDeleteError)
      return err(`Failed to delete document versions: ${versionsDeleteError.message}`, 502)
    }
  }

  // ── 7. Delete the document row ────────────────────────────────────────────────
  const { error: docDeleteError } = await admin
    .from('documents')
    .delete()
    .eq('id', documentId)

  if (docDeleteError) {
    console.error('[document-delete] documents delete error:', docDeleteError)
    return err(`Failed to delete document: ${docDeleteError.message}`, 502)
  }

  return new NextResponse(null, { status: 204 })
}
