import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  ORGANIZATIONS_STORAGE_BUCKET,
  AVATAR_ALLOWED_MIME,
  AVATAR_MAX_BYTES,
} from '@/lib/avatar-upload/constants'
import { buildAvatarObjectPath } from '@/lib/avatar-upload/path'
import { ensureOrganizationsBucket } from '@/lib/avatar-upload/ensure-bucket'

export const runtime = 'nodejs'

// ─── Response helpers ─────────────────────────────────────────────────────────

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

// ─── POST /api/employees/[id]/avatar ─────────────────────────────────────────

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

  // ── 2. Resolve org (multi-tenancy guard) ───────────────────────────────────
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
    .select('id, auth_id')
    .eq('id', employeeId)
    .eq('organization_id', orgId)
    .single()
  if (!employee) return err('Employee not found', 404)

  // ── 4. Parse and validate the uploaded file ────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return err('Invalid multipart form data', 400)
  }

  const file = formData.get('file')
  if (!(file instanceof File)) return err('No file provided', 400)

  if (!AVATAR_ALLOWED_MIME.has(file.type as never)) {
    return err('Only JPG and PNG images are allowed', 400)
  }

  if (file.size > AVATAR_MAX_BYTES) {
    return err('Image must not exceed 10 MB', 400)
  }

  // ── 5. Build storage path and upload (upsert) ──────────────────────────────
  const objectPath = buildAvatarObjectPath(orgId, employeeId, file.type)
  const buffer = Buffer.from(await file.arrayBuffer())

  const admin = createAdminClient()

  const bucketReady = await ensureOrganizationsBucket(admin)
  if (!bucketReady.ok) {
    console.error('[avatar-upload] organizations bucket check failed:', bucketReady.message)
    return err(`Storage is not available: ${bucketReady.message}`, 503)
  }

  const { error: uploadError } = await admin.storage
    .from(ORGANIZATIONS_STORAGE_BUCKET)
    .upload(objectPath, buffer, {
      contentType: file.type,
      upsert: true,
      // cacheControl tells CDN/browsers how long to serve the cached image.
      // A short TTL ensures a re-upload is visible quickly without manual cache busting.
      cacheControl: '60',
    })

  if (uploadError) {
    const detail =
      typeof uploadError === 'object' && uploadError && 'message' in uploadError
        ? String((uploadError as { message: string }).message)
        : JSON.stringify(uploadError)
    console.error('[avatar-upload] Storage upload error:', uploadError)
    return err(`Storage upload failed: ${detail}`, 502)
  }

  // ── 6. Compute public URL ──────────────────────────────────────────────────
  // Public bucket → getPublicUrl never throws; the URL is deterministic.
  const { data: urlData } = admin.storage
    .from(ORGANIZATIONS_STORAGE_BUCKET)
    .getPublicUrl(objectPath)

  // Append a cache-buster so browsers pick up the new image even if they have
  // the same path cached from a previous upload.
  const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`

  // ── 7. Persist URL to both tables ─────────────────────────────────────────
  const [empUpdate, profileUpdate] = await Promise.allSettled([
    supabase
      .from('employees')
      .update({ avatar_url: avatarUrl })
      .eq('id', employeeId)
      .eq('organization_id', orgId),

    // Only update profiles if there is a linked auth user.
    employee.auth_id
      ? supabase
          .from('profiles')
          .update({ avatar_url: avatarUrl })
          .eq('id', employee.auth_id)
      : Promise.resolve({ error: null }),
  ])

  if (empUpdate.status === 'rejected' || empUpdate.value?.error) {
    const detail =
      empUpdate.status === 'rejected'
        ? empUpdate.reason
        : empUpdate.value.error
    console.error('[avatar-upload] employees update failed:', detail)
  }

  if (profileUpdate.status === 'rejected' || profileUpdate.value?.error) {
    const detail =
      profileUpdate.status === 'rejected'
        ? profileUpdate.reason
        : profileUpdate.value.error
    console.error('[avatar-upload] profiles update failed:', detail)
  }

  // Revalidate server-rendered routes that embed employee avatars so the next
  // page load picks up the fresh URL without needing a full deploy.
  revalidatePath('/dashboard')
  // Employees list server component: app/dashboard/admin/employees/page.tsx
  revalidatePath('/dashboard/admin/employees')
  revalidatePath('/dashboard/admin/profile-update-requests')

  return NextResponse.json({ avatarUrl, objectPath })
}
