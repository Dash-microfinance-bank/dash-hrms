'use client'

import { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { DOCUMENT_ALLOWED_MIME, DOCUMENT_MAX_BYTES } from '@/lib/document-upload/constants'
import type { DocumentVersionCard } from '@/lib/data/employee-documents-tab'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocumentUploadStatus = 'idle' | 'uploading' | 'success' | 'error'

export type DocumentUploadInput = {
  file: File
  documentTypeId: string
  title: string
  issueDate?: string
  expiryDate?: string
}

export type UseDocumentUploadOptions = {
  employeeId: string
  /** Called with the persisted card once the server confirms the upload. */
  onCommitted?: (card: DocumentVersionCard) => void
}

export type UseDocumentUploadReturn = {
  upload: (input: DocumentUploadInput) => void
  /** 0–100 reflecting actual bytes transferred (XHR-based). */
  progress: number
  status: DocumentUploadStatus
  isUploading: boolean
  isError: boolean
  /** Reset back to idle — call when the form closes or on retry setup. */
  reset: () => void
}

// ─── Client-side validation ───────────────────────────────────────────────────

export function validateDocumentFile(file: File): string | null {
  if (!DOCUMENT_ALLOWED_MIME.has(file.type as never)) {
    return 'Only PDF, DOCX, PNG, JPEG, and JPG files are allowed'
  }
  if (file.size > DOCUMENT_MAX_BYTES) {
    return 'File must not exceed 50 MB'
  }
  return null
}

// ─── Network layer (XHR for real upload progress) ─────────────────────────────

function uploadDocumentXhr(
  employeeId: string,
  input: DocumentUploadInput,
  onProgress: (pct: number) => void,
  signal: AbortSignal,
): Promise<DocumentVersionCard> {
  return new Promise<DocumentVersionCard>((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText) as { card: DocumentVersionCard }
          resolve(body.card)
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
    form.append('file', input.file)
    form.append('documentTypeId', input.documentTypeId)
    form.append('title', input.title)
    if (input.issueDate) form.append('issueDate', input.issueDate)
    if (input.expiryDate) form.append('expiryDate', input.expiryDate)

    xhr.open('POST', `/api/employees/${employeeId}/documents/upload`)
    xhr.send(form)
  })
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDocumentUpload({
  employeeId,
  onCommitted,
}: UseDocumentUploadOptions): UseDocumentUploadReturn {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<DocumentUploadStatus>('idle')

  const mutation = useMutation<DocumentVersionCard, Error, DocumentUploadInput>({
    mutationFn: (input) => {
      const controller = new AbortController()
      return uploadDocumentXhr(employeeId, input, setProgress, controller.signal)
    },

    // Retry up to 3× with exponential back-off; skip retries for client errors.
    retry: (failureCount, error) => {
      if (failureCount >= 3) return false
      if ((error?.message ?? '').startsWith('HTTP 4')) return false
      return true
    },
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),

    onMutate: () => {
      setStatus('uploading')
      setProgress(0)
    },

    onSuccess: (card) => {
      setStatus('success')
      setProgress(100)
      onCommitted?.(card)
    },

    onError: (error) => {
      setStatus('error')
      const msg = error instanceof Error ? error.message : 'Upload failed'
      toast.error(`Document upload failed: ${msg}`)
    },
  })

  const upload = useCallback(
    (input: DocumentUploadInput) => {
      const validationError = validateDocumentFile(input.file)
      if (validationError) {
        toast.error(validationError)
        return
      }
      if (!input.title.trim()) {
        toast.error('Please enter a document title')
        return
      }
      mutation.mutate(input)
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
