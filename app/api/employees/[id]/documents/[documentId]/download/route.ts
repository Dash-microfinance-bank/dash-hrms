import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

// ─── GET /api/employees/[id]/documents/[documentId]/download ──────────────────
//
// Returns a short-lived (60 s) signed URL that forces a file download via
// Content-Disposition: attachment.  The client simply follows the redirect.
//
// Multi-tenancy: the document must belong to the caller's org AND employee.

export async function GET(
  request: NextRequest,
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
    .select('current_version_id')
    .eq('id', documentId)
    .eq('employee_id', employeeId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!doc) return err('Document not found', 404)
  if (!doc.current_version_id) return err('No file attached to this document', 404)

  // ── 4. Fetch the current version to get the storage path + filename ──────────
  const admin = createAdminClient()

  const { data: version } = await admin
    .from('document_versions')
    .select('storage_object_path, file_name, file_type')
    .eq('id', doc.current_version_id)
    .maybeSingle()

  if (!version?.storage_object_path) return err('Storage path not found', 404)

  // ── 5. Generate a short-lived signed download URL ─────────────────────────────
  const downloadFileName = (version.file_name as string | null) ?? 'document'

  const { data: signed, error: signError } = await admin.storage
    .from('organizations')
    .createSignedUrl(version.storage_object_path as string, 60, {
      download: downloadFileName,
    })

  if (signError || !signed?.signedUrl) {
    console.error('[document-download] signed URL error:', signError)
    return err('Could not generate download link', 502)
  }

  // JSON mode — used by the UI to show a loading state while the file is fetched.
  const wantsJson = request.nextUrl.searchParams.get('format') === 'json'
  if (wantsJson) {
    return NextResponse.json({
      signedUrl: signed.signedUrl,
      fileName: downloadFileName,
    })
  }

  // ── 6. Redirect the client to the signed download URL ─────────────────────────
  return NextResponse.redirect(signed.signedUrl, { status: 302 })
}
