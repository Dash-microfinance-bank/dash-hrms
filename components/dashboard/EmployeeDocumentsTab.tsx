'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  CheckIcon,
  DownloadIcon,
  EyeIcon,
  FileTextIcon,
  Loader2Icon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useDocumentUpload } from '@/lib/hooks/use-document-upload'
import type {
  EmployeeDocumentsResponse,
  DocumentTypeTabItem,
  DocumentVersionCard,
} from '@/app/api/employees/[id]/documents/route'

// ─── Props ────────────────────────────────────────────────────────────────────

type EmployeeDocumentsTabProps = {
  employeeId: string
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string | null {
  if (bytes == null) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatShortDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type UploadDateValidation =
  | { valid: true }
  | { valid: false; reason: 'expiry_without_issue' | 'issue_not_before_expiry' }

/**
 * `<input type="date">` values are `YYYY-MM-DD`; string order matches calendar order.
 * - Expiry alone is invalid (expiry requires issue).
 * - When both are set, issue must be strictly before expiry (not same day).
 */
function validateUploadDocumentDates(issue: string, expiry: string): UploadDateValidation {
  const hasIssue = Boolean(issue)
  const hasExpiry = Boolean(expiry)
  if (hasExpiry && !hasIssue) return { valid: false, reason: 'expiry_without_issue' }
  if (hasIssue && hasExpiry && issue >= expiry) {
    return { valid: false, reason: 'issue_not_before_expiry' }
  }
  return { valid: true }
}

// ─── Upload progress ring ─────────────────────────────────────────────────────

function ProgressRing({ progress }: { progress: number }) {
  const radius = 10
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - progress / 100)
  return (
    <svg className="-rotate-90 size-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <circle
        cx="12" cy="12" r={radius}
        fill="none" stroke="currentColor" strokeWidth="2.5"
        className="text-muted/40"
      />
      <circle
        cx="12" cy="12" r={radius}
        fill="none" stroke="currentColor" strokeWidth="2.5"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-primary transition-[stroke-dashoffset] duration-150 ease-linear"
      />
    </svg>
  )
}

// ─── Upload form ──────────────────────────────────────────────────────────────

type UploadFormProps = {
  docType: DocumentTypeTabItem
  employeeId: string
  onCancel: () => void
  onCommitted: (card: DocumentVersionCard) => void
}

function UploadForm({ docType, employeeId, onCancel, onCommitted }: UploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')

  const { upload, progress, isUploading, isError, reset } = useDocumentUpload({
    employeeId,
    onCommitted: (card) => {
      toast.success(`"${card.title}" uploaded successfully`)
      onCommitted(card)
    },
  })

  const previewUrl = useMemo(() => {
    if (!selectedFile || !selectedFile.type.startsWith('image/')) return null
    return URL.createObjectURL(selectedFile)
  }, [selectedFile])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const dateValidation = useMemo(
    () => validateUploadDocumentDates(issueDate, expiryDate),
    [issueDate, expiryDate],
  )
  const datesInvalid = !dateValidation.valid
  const dateRangeErrorId = `upload-date-range-${docType.id}`

  const issueFieldInvalid =
    !dateValidation.valid && dateValidation.reason === 'issue_not_before_expiry'
  const expiryFieldInvalid = !dateValidation.valid

  const dateValidationMessage =
    !dateValidation.valid && dateValidation.reason === 'expiry_without_issue'
      ? 'Enter an issue date before adding an expiry date.'
      : !dateValidation.valid
        ? 'Issue date must be earlier than the expiry date (same day is not allowed).'
        : ''

  const handleSubmit = () => {
    if (!selectedFile) return
    if (!dateValidation.valid) {
      toast.error(dateValidationMessage)
      return
    }
    upload({
      file: selectedFile,
      documentTypeId: docType.id,
      title: title.trim(),
      issueDate: issueDate || undefined,
      expiryDate: expiryDate || undefined,
    })
  }

  const handleRetry = () => {
    reset()
    if (!selectedFile) return
    if (!dateValidation.valid) {
      toast.error(dateValidationMessage)
      return
    }
    upload({
      file: selectedFile,
      documentTypeId: docType.id,
      title: title.trim(),
      issueDate: issueDate || undefined,
      expiryDate: expiryDate || undefined,
    })
  }

  const canSubmit =
    !!selectedFile && title.trim().length > 0 && !isUploading && dateValidation.valid

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-3">
      {/* Form header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Add file to {docType.name}</p>
        <button
          type="button"
          onClick={onCancel}
          disabled={isUploading}
          aria-label="Close upload form"
          className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {/* File picker */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground" htmlFor={`upload-file-${docType.id}`}>
          File
        </label>
        <Input
          id={`upload-file-${docType.id}`}
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.png,.jpeg,.jpg"
          disabled={isUploading}
          onChange={(e) => {
            setSelectedFile(e.target.files?.[0] ?? null)
            reset()
          }}
        />
      </div>

      {/* Inline file preview */}
      {selectedFile ? (
        <div className="rounded-md border bg-background p-2" aria-label="Selected file preview">
          {previewUrl ? (
            <div className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={`Preview of ${selectedFile.name}`}
                className="max-h-40 w-auto rounded border object-contain"
              />
              <p className="text-xs text-muted-foreground truncate">{selectedFile.name}</p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground truncate">{selectedFile.name}</p>
            </div>
          )}
        </div>
      ) : null}

      {/* Metadata fields */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs text-muted-foreground" htmlFor={`upload-title-${docType.id}`}>
            Title
          </label>
          <Input
            id={`upload-title-${docType.id}`}
            value={title}
            disabled={isUploading}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Valid Passport Bio Page"
            className="focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor={`upload-issue-${docType.id}`}>
            Issue date <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <Input
            id={`upload-issue-${docType.id}`}
            type="date"
            value={issueDate}
            disabled={isUploading}
            aria-invalid={issueFieldInvalid}
            aria-describedby={issueFieldInvalid ? dateRangeErrorId : undefined}
            onChange={(e) => setIssueDate(e.target.value)}
            className={
              issueFieldInvalid
                ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-destructive! outline-none! focus:border-destructive!'
                : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
            }
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor={`upload-expiry-${docType.id}`}>
            Expiry date{' '}
            <span className="text-muted-foreground/60">(optional — requires issue date)</span>
          </label>
          <Input
            id={`upload-expiry-${docType.id}`}
            type="date"
            value={expiryDate}
            disabled={isUploading}
            aria-invalid={expiryFieldInvalid}
            aria-describedby={datesInvalid ? dateRangeErrorId : undefined}
            onChange={(e) => setExpiryDate(e.target.value)}
            className={
              expiryFieldInvalid
                ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-destructive! outline-none! focus:border-destructive!'
                : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
            }
          />
        </div>
        {datesInvalid ? (
          <p
            id={dateRangeErrorId}
            role="alert"
            className="text-xs text-destructive sm:col-span-2"
          >
            {dateValidationMessage}
          </p>
        ) : null}
      </div>

      {/* Upload progress bar — visible while uploading */}
      {isUploading ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Loader2Icon className="size-3 animate-spin" />
              Uploading…
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-150 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* Error state */}
      {isError ? (
        <p className="text-xs text-destructive">Upload failed — check your connection and retry.</p>
      ) : null}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading}
          onClick={onCancel}
        >
          Cancel
        </Button>

        {isError ? (
          <Button type="button" size="sm" onClick={handleRetry} disabled={datesInvalid}>
            Retry
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {isUploading ? (
              <>
                <ProgressRing progress={progress} />
                <span className="ml-1.5">Uploading…</span>
              </>
            ) : (
              <>
                <CheckIcon className="mr-1.5 size-4" />
                Add file
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyRequiredPlaceholder() {
  return (
    <div className="rounded-md border border-dashed bg-muted/10 p-4 text-center">
      <p className="text-sm font-medium">No file uploaded yet</p>
      <p className="mt-1 text-xs text-muted-foreground">
        This required document type needs at least one uploaded file.
      </p>
    </div>
  )
}

type FileCardProps = {
  card: DocumentVersionCard
  employeeId: string
  onDelete: () => Promise<void>
}

function FileCard({ card, employeeId, onDelete }: FileCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const sizeLabel = formatBytes(card.fileSize)
  const uploadedLabel = formatDate(card.uploadedAt)
  const issuedLabel = formatShortDate(card.issueDate)
  const expiryLabel = formatShortDate(card.expiryDate)

  const metaParts: string[] = [`Uploaded ${uploadedLabel}`]
  if (sizeLabel) metaParts.push(sizeLabel)

  const handleConfirmDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete()
      toast.success(`"${card.title}" deleted`)
    } catch {
      toast.error(`Failed to delete "${card.title}"`)
      setIsDeleting(false)
      setConfirmOpen(false)
    }
  }

  const downloadHref = `/api/employees/${employeeId}/documents/${card.documentId}/download`

  const handleDownload = async () => {
    if (isDownloading) return
    setIsDownloading(true)
    try {
      const metaRes = await fetch(`${downloadHref}?format=json`, { credentials: 'same-origin' })
      if (!metaRes.ok) {
        const body = (await metaRes.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${metaRes.status}`)
      }
      const { signedUrl, fileName } = (await metaRes.json()) as {
        signedUrl: string
        fileName: string
      }

      try {
        const fileRes = await fetch(signedUrl, { mode: 'cors' })
        if (!fileRes.ok) throw new Error('File request failed')
        const blob = await fileRes.blob()
        const objectUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = objectUrl
        a.download = fileName
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(objectUrl)
      } catch {
        // Cross-origin or network — open signed URL so the browser can still fetch it.
        window.open(signedUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="rounded-md border bg-muted/10 p-3">
      <div className="flex items-center justify-between gap-3">
        {/* Left: metadata */}
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-semibold leading-snug" title={card.title}>
            {card.title}
          </p>
          <span className="block text-xs text-muted-foreground">
            {metaParts.join(' • ')}
          </span>
          {issuedLabel || expiryLabel ? (
            <span className="block text-xs text-muted-foreground">
              {issuedLabel ? `Issued: ${issuedLabel}` : null}
              {issuedLabel && expiryLabel ? ' · ' : null}
              {expiryLabel ? `Expires: ${expiryLabel}` : null}
            </span>
          ) : null}
        </div>

        {/* Right: actions */}
        <div className="flex shrink-0 items-center gap-0.5">
          {/* View — open in new tab */}
          {card.fileUrl ? (
            <a href={card.fileUrl} target="_blank" rel="noopener noreferrer" tabIndex={-1}>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                title="View file"
                aria-label="View file"
              >
                <EyeIcon className="size-3.5" />
              </Button>
            </a>
          ) : null}

          {/* Download — JSON metadata + client blob save (shows loader while in flight) */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground"
            title="Download file"
            aria-label="Download file"
            aria-busy={isDownloading}
            disabled={isDownloading}
            onClick={handleDownload}
          >
            {isDownloading ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <DownloadIcon className="size-3.5" />
            )}
          </Button>

          {/* Delete — confirmation dialog */}
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                title="Delete file"
                aria-label="Delete file"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <Trash2Icon className="size-3.5" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete document?</AlertDialogTitle>
                <AlertDialogDescription>
                  <strong>&ldquo;{card.title}&rdquo;</strong> will be permanently deleted along with
                  all its versions and the stored file. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? (
                    <Loader2Icon className="mr-1.5 size-4 animate-spin" />
                  ) : null}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  )
}

// ─── Document type section ────────────────────────────────────────────────────

function DocumentTypeSection({
  docType,
  serverCards,
  employeeId,
}: {
  docType: DocumentTypeTabItem
  serverCards: DocumentVersionCard[]
  employeeId: string
}) {
  const [uploadOpen, setUploadOpen] = useState(false)
  // Cards added optimistically in this session (before next full fetch).
  const [localCards, setLocalCards] = useState<DocumentVersionCard[]>([])
  // Document IDs that were deleted in this session — filtered out of allCards.
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  // Merge: local overrides server for the same documentId (re-upload when
  // allow_multiple is false); then server cards without a local override.
  const localByDocId = new Map(localCards.map((c) => [c.documentId, c]))
  const serverWithoutOverride = serverCards.filter((c) => !localByDocId.has(c.documentId))
  const allCards = [...localCards, ...serverWithoutOverride].filter(
    (c) => !deletedIds.has(c.documentId),
  )
  const fileCount = allCards.length

  const handleCommitted = (card: DocumentVersionCard) => {
    setLocalCards((prev) => {
      const withoutSameDoc = prev.filter((c) => c.documentId !== card.documentId)
      return [card, ...withoutSameDoc]
    })
    setUploadOpen(false)
  }

  const handleDelete = async (documentId: string) => {
    const res = await fetch(`/api/employees/${employeeId}/documents/${documentId}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error ?? `HTTP ${res.status}`)
    }
    setDeletedIds((prev) => new Set([...prev, documentId]))
  }

  return (
    <div className="rounded-lg border bg-card">
      {/* Header row */}
      <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{docType.name}</p>
            {docType.is_required ? (
              <span className="rounded-full border border-amber-400/50 bg-amber-100/50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                Required
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {fileCount} file{fileCount === 1 ? '' : 's'}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setUploadOpen((prev) => !prev)}
          aria-label={`Upload file to ${docType.name}`}
          className="bg-black text-white hover:bg-black/90 hover:text-secondary cursor-pointer"
        >
          <UploadIcon className="mr-1.5 size-3" />
          Upload
        </Button>
      </div>

      {/* Body */}
      <div className="border-t p-3 sm:p-4">
        <div className="space-y-2">
          {/* Upload form — rendered at the top when open */}
          {uploadOpen ? (
            <UploadForm
              docType={docType}
              employeeId={employeeId}
              onCancel={() => setUploadOpen(false)}
              onCommitted={handleCommitted}
            />
          ) : null}

          {fileCount === 0 && docType.is_required && !uploadOpen ? (
            <EmptyRequiredPlaceholder />
          ) : null}

          {fileCount === 0 && !docType.is_required && !uploadOpen ? (
            <div className="rounded-md border border-dashed bg-muted/10 p-3 text-center">
              <p className="text-xs text-muted-foreground">No files uploaded for this type.</p>
            </div>
          ) : null}

          {allCards.map((card) => (
            <FileCard
              key={card.versionId}
              card={card}
              employeeId={employeeId}
              onDelete={() => handleDelete(card.documentId)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DocumentsTabSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="border-t pt-3 space-y-2">
            <div className="h-14 w-full rounded-md bg-muted/60" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EmployeeDocumentsTab({ employeeId }: EmployeeDocumentsTabProps) {
  const [payload, setPayload] = useState<EmployeeDocumentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!employeeId) return
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/employees/${employeeId}/documents`)
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? `HTTP ${res.status}`)
        }
        const data = (await res.json()) as EmployeeDocumentsResponse
        if (!cancelled) {
          setPayload(data)
          setFetchError(null)
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setFetchError(e instanceof Error ? e.message : 'Failed to load documents')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [employeeId])

  if (loading) return <DocumentsTabSkeleton />

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/30 px-4 py-10 text-center">
        <FileTextIcon className="size-7 text-muted-foreground/60" />
        <p className="mt-2 text-sm font-medium">Could not load documents</p>
        <p className="mt-1 text-xs text-muted-foreground">{fetchError}</p>
      </div>
    )
  }

  if (!payload || payload.documentTypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/30 px-4 py-12 text-center">
        <FileTextIcon className="size-7 text-muted-foreground/60" />
        <p className="mt-2 text-sm font-medium">No document types configured</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Set up employee document types in the admin area to manage documents here.
        </p>
      </div>
    )
  }

  // Group server-fetched cards by document type id.
  const cardsByTypeId = new Map<string, DocumentVersionCard[]>()
  for (const card of payload.versionCards) {
    const existing = cardsByTypeId.get(card.documentTypeId)
    if (existing) {
      existing.push(card)
    } else {
      cardsByTypeId.set(card.documentTypeId, [card])
    }
  }

  return (
    <div className="space-y-3">
      {/* Intro strip */}
      <div className="rounded-lg border bg-muted/20 px-3 py-2">
        <p className="text-sm font-medium">Employee Documents</p>
        <p className="text-xs text-muted-foreground">
          Supported formats: PDF, DOCX, PNG, JPEG, JPG
        </p>
      </div>

      {payload.documentTypes.map((docType) => (
        <DocumentTypeSection
          key={docType.id}
          docType={docType}
          serverCards={cardsByTypeId.get(docType.id) ?? []}
          employeeId={employeeId}
        />
      ))}
    </div>
  )
}
