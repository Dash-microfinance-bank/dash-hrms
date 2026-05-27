import type { SupabaseClient } from '@supabase/supabase-js'
import { ORGANIZATIONS_STORAGE_BUCKET } from '@/lib/avatar-upload/constants'

export type UploadPayslipResult =
  | { ok: true; objectPath: string; fileUrl: string }
  | { ok: false; message: string }

export async function uploadPayslipPdf(
  admin: SupabaseClient,
  objectPath: string,
  pdfBuffer: Buffer
): Promise<UploadPayslipResult> {
  const { error: uploadError } = await admin.storage
    .from(ORGANIZATIONS_STORAGE_BUCKET)
    .upload(objectPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: '3600',
    })

  if (uploadError) {
    const message =
      typeof uploadError === 'object' && 'message' in uploadError
        ? String((uploadError as { message: string }).message)
        : 'Storage upload failed'
    return { ok: false, message }
  }

  const { data: urlData } = admin.storage
    .from(ORGANIZATIONS_STORAGE_BUCKET)
    .getPublicUrl(objectPath)

  return {
    ok: true,
    objectPath,
    fileUrl: urlData.publicUrl,
  }
}
