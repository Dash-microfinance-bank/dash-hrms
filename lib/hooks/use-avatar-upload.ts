'use client'

import { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AVATAR_ALLOWED_MIME, AVATAR_MAX_BYTES } from '@/lib/avatar-upload/constants'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AvatarUploadStatus = 'idle' | 'uploading' | 'success' | 'error'

export type UseAvatarUploadOptions = {
  employeeId: string
  /** Called with the canonical public URL once the server confirms persistence. */
  onCommitted?: (avatarUrl: string) => void
}

export type UseAvatarUploadReturn = {
  /** Trigger the upload for a given File. */
  upload: (file: File) => void
  /** 0–100 upload progress (XHR-based, so it reflects actual bytes sent). */
  progress: number
  status: AvatarUploadStatus
  isUploading: boolean
  isError: boolean
  /** Reset status + progress back to idle (e.g. on modal close). */
  reset: () => void
}

// ─── Network layer (XHR for real upload progress) ─────────────────────────────

function uploadAvatarXhr(
  employeeId: string,
  file: File,
  onProgress: (pct: number) => void,
  signal: AbortSignal,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText) as { avatarUrl: string }
          resolve(body.avatarUrl)
        } catch {
          reject(new Error('Unexpected response from server'))
        }
      } else {
        try {
          const body = JSON.parse(xhr.responseText) as { error?: string }
          reject(new Error(body.error ?? `HTTP ${xhr.status}`))
        } catch {
          reject(new Error(`HTTP ${xhr.status}`))
        }
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
    xhr.addEventListener('abort', () => reject(new Error('Upload was aborted')))

    signal.addEventListener('abort', () => xhr.abort())

    const form = new FormData()
    form.append('file', file)

    xhr.open('POST', `/api/employees/${employeeId}/avatar`)
    xhr.send(form)
  })
}

// ─── Client-side validation ───────────────────────────────────────────────────

export function validateAvatarFile(file: File): string | null {
  if (!AVATAR_ALLOWED_MIME.has(file.type as never)) {
    return 'Only JPG and PNG images are allowed'
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return 'Image must not exceed 10 MB'
  }
  return null
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAvatarUpload({
  employeeId,
  onCommitted,
}: UseAvatarUploadOptions): UseAvatarUploadReturn {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<AvatarUploadStatus>('idle')

  const mutation = useMutation<string, Error, File>({
    mutationFn: (file: File) => {
      const controller = new AbortController()
      return uploadAvatarXhr(employeeId, file, setProgress, controller.signal)
    },

    // Retry up to 3 times with exponential back-off, but only for network/5xx errors.
    retry: (failureCount, error) => {
      if (failureCount >= 3) return false
      // Do not retry explicit client errors surfaced by the server (4xx-family messages).
      const msg = error?.message ?? ''
      if (msg.startsWith('HTTP 4')) return false
      return true
    },
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),

    onMutate: () => {
      setStatus('uploading')
      setProgress(0)
    },

    onSuccess: (avatarUrl) => {
      setStatus('success')
      setProgress(100)
      onCommitted?.(avatarUrl)
    },

    onError: (error) => {
      setStatus('error')
      const msg = error instanceof Error ? error.message : 'Upload failed'
      toast.error(`Avatar upload failed: ${msg}. Tap to retry.`)
    },
  })

  const upload = useCallback(
    (file: File) => {
      const validationError = validateAvatarFile(file)
      if (validationError) {
        toast.error(validationError)
        return
      }
      mutation.mutate(file)
    },
    [mutation],
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setProgress(0)
    mutation.reset()
  }, [mutation])

  return {
    upload,
    progress,
    status,
    isUploading: status === 'uploading',
    isError: status === 'error',
    reset,
  }
}
