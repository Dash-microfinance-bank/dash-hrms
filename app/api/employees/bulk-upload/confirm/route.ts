import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PreviewRow } from '@/app/api/employees/bulk-upload/preview/route'

// ─── Runtime ──────────────────────────────────────────────────────────────────

// Node.js runtime required: Supabase auth HTTP call + file Buffer handling.
export const runtime = 'nodejs'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const STORAGE_BUCKET = 'bulk-uploads'
/** Rows per Supabase PostgREST insert call — stays well below the 2 000-row limit. */
const ROW_INSERT_CHUNK = 250

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConfirmRequest {
  /** JSON-serialised PreviewRow[] — multipart field name: "rows" */
  rows: PreviewRow[]
  /** The original .csv / .xlsx file — multipart field name: "file" */
  file: File
}

export interface ConfirmResponse {
  job_id: string
}

/** Shape stored in bulk_upload_row_logs.raw_data (jsonb) */
type RowLogInsert = {
  job_id: string
  organization_id: string
  row_number: number
  raw_data: PreviewRow['data']
  status: 'valid' | 'failed'
  error_message: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

/**
 * Ensure the storage bucket exists. On 409 (already exists) we continue;
 * any other error is re-thrown.
 */
async function ensureBucket(
  admin: ReturnType<typeof createAdminClient>
): Promise<void> {
  const { error } = await admin.storage.createBucket(STORAGE_BUCKET, {
    public: false,
    fileSizeLimit: MAX_FILE_SIZE * 2,
  })
  if (error && !error.message.toLowerCase().includes('already exists')) {
    throw new Error(`Storage bucket creation failed: ${error.message}`)
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) {
      return NextResponse.json(
        { error: 'Organization not found for this user' },
        { status: 403 }
      )
    }
    const orgId = profile.organization_id as string

    // ── 2. Parse multipart form ───────────────────────────────────────────────
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { error: 'Request must be multipart/form-data' },
        { status: 400 }
      )
    }

    // ── 2a. File ──────────────────────────────────────────────────────────────
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Missing required field: "file"' },
        { status: 400 }
      )
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum is ${MAX_FILE_SIZE / 1024 / 1024} MB` },
        { status: 413 }
      )
    }
    const fileName = file.name.toLowerCase()
    const fileExt = fileName.endsWith('.xlsx')
      ? 'xlsx'
      : fileName.endsWith('.csv')
      ? 'csv'
      : null

    if (!fileExt) {
      return NextResponse.json(
        { error: 'Unsupported file type. Must be .csv or .xlsx' },
        { status: 415 }
      )
    }

    // ── 2b. Rows (JSON) ───────────────────────────────────────────────────────
    const rowsField = formData.get('rows')
    if (!rowsField || typeof rowsField !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: "rows"' },
        { status: 400 }
      )
    }

    let rows: PreviewRow[]
    try {
      rows = JSON.parse(rowsField) as PreviewRow[]
    } catch {
      return NextResponse.json(
        { error: '"rows" must be a valid JSON string' },
        { status: 400 }
      )
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: '"rows" must be a non-empty array' },
        { status: 422 }
      )
    }

    // Only valid rows will be processed; keep the original array for logging.
    const validRows = rows.filter((r) => r.status === 'valid')
    if (validRows.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows to import' },
        { status: 422 }
      )
    }

    // ── 3. Create bulk_upload_jobs record ─────────────────────────────────────
    // Use the user-scoped client so the RLS INSERT policy attaches organization_id
    // automatically via current_user_organization_id().
    const { data: job, error: jobError } = await supabase
      .from('bulk_upload_jobs')
      .insert({
        organization_id: orgId,
        uploaded_by: user.id,
        status: 'pending',
        total_rows: rows.length,
        successful_rows: 0,
        failed_rows: 0,
      })
      .select('id')
      .single()

    if (jobError || !job) {
      console.error('[confirm] job insert failed:', jobError)
      return NextResponse.json(
        { error: 'Failed to create upload job' },
        { status: 500 }
      )
    }
    const jobId = job.id as string

    // ── 4. Upload original file to Supabase Storage ───────────────────────────
    // Use admin client so storage RLS doesn't block the upload.
    const admin = createAdminClient()

    await ensureBucket(admin)

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const storagePath = `${orgId}/${jobId}.${fileExt}`

    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType:
          fileExt === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv',
        upsert: false,
      })

    if (uploadError) {
      console.error('[confirm] storage upload failed:', uploadError)
      // Roll back the job record — don't leave orphaned jobs.
      await supabase.from('bulk_upload_jobs').delete().eq('id', jobId)
      return NextResponse.json(
        { error: `File upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Construct the signed storage path (not publicly accessible).
    const fileUrl = `${STORAGE_BUCKET}/${storagePath}`

    // Persist the file URL on the job record.
    await supabase
      .from('bulk_upload_jobs')
      .update({ file_url: fileUrl })
      .eq('id', jobId)

    // ── 5. Store all rows in bulk_upload_row_logs ─────────────────────────────
    // Admin client bypasses RLS — we enforce org scope explicitly on every row.
    const rowLogInserts: RowLogInsert[] = rows.map((r) => ({
      job_id: jobId,
      organization_id: orgId,
      row_number: r.row_number,
      raw_data: r.data,
      // Rows that were already invalid at preview time are stored as 'failed'
      // so they're visible in the job log but skipped by the edge function.
      status: r.status === 'valid' ? 'valid' : 'failed',
      error_message: r.error_message ?? null,
    }))

    const rowChunks = chunk(rowLogInserts, ROW_INSERT_CHUNK)
    for (const batch of rowChunks) {
      const { error: rowsError } = await admin
        .from('bulk_upload_row_logs')
        .insert(batch)

      if (rowsError) {
        console.error('[confirm] row log insert failed:', rowsError)
        // Roll back: delete the job (cascades to row_logs) and the stored file.
        await Promise.all([
          supabase.from('bulk_upload_jobs').delete().eq('id', jobId),
          admin.storage.from(STORAGE_BUCKET).remove([storagePath]),
        ])
        return NextResponse.json(
          { error: 'Failed to store row logs. The upload has been cancelled.' },
          { status: 500 }
        )
      }
    }

    // ── 6. Trigger edge function (fire-and-forget via `after()`) ──────────────
    // `after()` defers execution until after the response is flushed, and is
    // tracked by Next.js's serverless lifetime so it can't be killed mid-flight.
    after(async () => {
      try {
        const { error: fnError } = await admin.functions.invoke(
          'process-bulk-upload',
          {
            // org_id is intentionally omitted — the edge function fetches it
            // from the DB so it can never be spoofed via the request payload.
            body: { job_id: jobId },
          }
        )
        if (fnError) {
          console.error('[confirm] edge function invoke failed:', fnError)
        }
      } catch (err) {
        console.error('[confirm] edge function invoke threw:', err)
      }
    })

    // ── 7. Return job_id immediately ──────────────────────────────────────────
    const response: ConfirmResponse = { job_id: jobId }
    return NextResponse.json(response, { status: 202 })
  } catch (err) {
    console.error('[bulk-upload confirm]', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
