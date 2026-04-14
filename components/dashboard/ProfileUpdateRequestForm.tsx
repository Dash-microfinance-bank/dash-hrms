'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  CheckIcon,
  CreditCardIcon,
  DownloadIcon,
  EyeIcon,
  FileTextIcon,
  GraduationCapIcon,
  Loader2Icon,
  PhoneIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ProfileSchema } from '@/lib/data/employee-permissions'
import type {
  DocumentTypeTabItem,
  DocumentVersionCard,
  EmployeeDocumentsResponse,
  PendingDocumentItem,
} from '@/app/api/employees/[id]/documents/route'
import type {
  EducationRecord,
  EmployeeCollectionsForEss,
  ExperienceRecord,
  NextOfKinRecord,
  PendingRecordCreate,
  PersonRecord,
  TrainingRecord,
} from '@/lib/data/employee-profile'
import type {
  RecordCreateRequest,
  RecordCreateTable,
} from '@/lib/actions/profile-update-requests'

type TabId = 'personal' | 'contact' | 'finance' | 'documents' | 'relations' | 'career'

type TabConfig = {
  id: TabId
  label: string
  Icon: React.ComponentType<{ className?: string }>
}

const TABS: TabConfig[] = [
  { id: 'personal', label: 'Personal', Icon: UserIcon },
  { id: 'contact', label: 'Contact', Icon: PhoneIcon },
  { id: 'finance', label: 'Finance', Icon: CreditCardIcon },
  { id: 'documents', label: 'Documents', Icon: FileTextIcon },
  { id: 'relations', label: 'Relations', Icon: UsersIcon },
  { id: 'career', label: 'Career', Icon: GraduationCapIcon },
]

// ─── ESS Documents tab ────────────────────────────────────────────────────────
// Follows the exact design pattern of EmployeeDocumentsTab (admin 360 view).

function essFormatBytes(bytes: number | null): string | null {
  if (bytes == null) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function essFormatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function essFormatShortDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type EssUploadDateValidation =
  | { valid: true }
  | { valid: false; reason: 'expiry_without_issue' | 'issue_not_before_expiry' }

function validateEssDocumentDates(issue: string, expiry: string): EssUploadDateValidation {
  const hasIssue = Boolean(issue)
  const hasExpiry = Boolean(expiry)
  if (hasExpiry && !hasIssue) return { valid: false, reason: 'expiry_without_issue' }
  if (hasIssue && hasExpiry && issue >= expiry) {
    return { valid: false, reason: 'issue_not_before_expiry' }
  }
  return { valid: true }
}

// ─── Queued document (staged locally, pending actual upload) ─────────────────

type QueuedDocument = {
  /** Stable client-side key for React lists and removal. */
  clientId: string
  documentTypeId: string
  file: File
  title: string
  issueDate: string | null
  expiryDate: string | null
}

// ─── Upload form ──────────────────────────────────────────────────────────────

type EssUploadFormProps = {
  docType: DocumentTypeTabItem
  onCancel: () => void
  onQueued: (doc: QueuedDocument) => void
}

function EssUploadForm({ docType, onCancel, onQueued }: EssUploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const typeId = docType.id

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')

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
    () => validateEssDocumentDates(issueDate, expiryDate),
    [issueDate, expiryDate],
  )
  const datesInvalid = !dateValidation.valid
  const dateRangeErrorId = `ess-doc-date-range-${typeId}`
  const issueFieldInvalid =
    !dateValidation.valid && dateValidation.reason === 'issue_not_before_expiry'
  const expiryFieldInvalid = !dateValidation.valid
  const dateValidationMessage =
    !dateValidation.valid && dateValidation.reason === 'expiry_without_issue'
      ? 'Enter an issue date before adding an expiry date.'
      : !dateValidation.valid
        ? 'Issue date must be earlier than the expiry date (same day is not allowed).'
        : ''

  const canSubmit =
    !!selectedFile && title.trim().length > 0 && dateValidation.valid

  const resetForm = () => {
    setSelectedFile(null)
    setTitle('')
    setIssueDate('')
    setExpiryDate('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleSubmit = () => {
    if (!canSubmit || !selectedFile) return
    onQueued({
      clientId: crypto.randomUUID(),
      documentTypeId: docType.id,
      file: selectedFile,
      title: title.trim(),
      issueDate: issueDate || null,
      expiryDate: expiryDate || null,
    })
    resetForm()
    onCancel()
  }

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Add file to {docType.name}</p>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close upload form"
          className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {/* File picker */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground" htmlFor={`ess-doc-file-${typeId}`}>
          File
        </label>
        <Input
          id={`ess-doc-file-${typeId}`}
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.png,.jpeg,.jpg"
          onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
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
          <label className="text-xs text-muted-foreground" htmlFor={`ess-doc-title-${typeId}`}>
            Title
          </label>
          <Input
            id={`ess-doc-title-${typeId}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Valid Passport Bio Page"
            className="focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor={`ess-doc-issue-${typeId}`}>
            Issue date <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <Input
            id={`ess-doc-issue-${typeId}`}
            type="date"
            value={issueDate}
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
          <label className="text-xs text-muted-foreground" htmlFor={`ess-doc-expiry-${typeId}`}>
            Expiry date{' '}
            <span className="text-muted-foreground/60">(optional — requires issue date)</span>
          </label>
          <Input
            id={`ess-doc-expiry-${typeId}`}
            type="date"
            value={expiryDate}
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

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          <CheckIcon className="mr-1.5 size-4" />
          Add file
        </Button>
      </div>
    </div>
  )
}

// ─── File card ────────────────────────────────────────────────────────────────

function EssFileCard({
  card,
  employeeId,
}: {
  card: DocumentVersionCard
  employeeId: string
}) {
  const [isDownloading, setIsDownloading] = useState(false)

  const sizeLabel = essFormatBytes(card.fileSize)
  const uploadedLabel = essFormatDate(card.uploadedAt)
  const issuedLabel = essFormatShortDate(card.issueDate)
  const expiryLabel = essFormatShortDate(card.expiryDate)

  const metaParts: string[] = [`Uploaded ${uploadedLabel}`]
  if (sizeLabel) metaParts.push(sizeLabel)

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
        // Cross-origin or network fallback — open signed URL directly.
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
      <div className="flex items-start justify-between gap-3">
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
          {card.fileUrl ? (
            <a href={card.fileUrl} target="_blank" rel="noopener noreferrer" tabIndex={-1}>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                title="View file"
                aria-label="View file"
              >
                <EyeIcon className="size-3.5" />
              </Button>
            </a>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
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
        </div>
      </div>
    </div>
  )
}

// ─── Queued document card ─────────────────────────────────────────────────────

function EssQueuedCard({
  doc,
  onRemove,
}: {
  doc: QueuedDocument
  onRemove: () => void
}) {
  const sizeLabel = essFormatBytes(doc.file.size)
  const issuedLabel = essFormatShortDate(doc.issueDate)
  const expiryLabel = essFormatShortDate(doc.expiryDate)

  const metaParts: string[] = [doc.file.name]
  if (sizeLabel) metaParts.push(sizeLabel)

  return (
    <div className="rounded-md border border-dashed bg-muted/5 p-3">
      <div className="flex items-start justify-between gap-3">
        {/* Left: metadata */}
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold leading-snug" title={doc.title}>
              {doc.title}
            </p>
            <span className="shrink-0 rounded-full border border-blue-400/50 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
              Queued
            </span>
          </div>
          <span className="block text-xs text-muted-foreground truncate">
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

        {/* Right: remove from queue */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
          title="Remove from queue"
          aria-label="Remove from upload queue"
          onClick={onRemove}
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── Pending approval card (submitted, awaiting HR review) ───────────────────

function EssPendingDocumentCard({ item }: { item: PendingDocumentItem }) {
  const sizeLabel = essFormatBytes(item.fileSize)
  const issuedLabel = essFormatShortDate(item.issueDate)
  const expiryLabel = essFormatShortDate(item.expiryDate)

  const metaParts: string[] = []
  if (item.fileName) metaParts.push(item.fileName)
  if (sizeLabel) metaParts.push(sizeLabel)

  return (
    <div className="rounded-md border border-amber-200/70 bg-amber-50/50 p-3">
      <div className="flex items-start justify-between gap-3">
        {/* Left: metadata */}
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="truncate text-sm font-semibold leading-snug" title={item.title}>
              {item.title}
            </p>
            <span className="shrink-0 rounded-full border border-amber-400/60 bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              Awaiting approval
            </span>
          </div>
          {metaParts.length > 0 ? (
            <span className="block truncate text-xs text-muted-foreground">
              {metaParts.join(' · ')}
            </span>
          ) : null}
          {issuedLabel || expiryLabel ? (
            <span className="block text-xs text-muted-foreground">
              {issuedLabel ? `Issued: ${issuedLabel}` : null}
              {issuedLabel && expiryLabel ? ' · ' : null}
              {expiryLabel ? `Expires: ${expiryLabel}` : null}
            </span>
          ) : null}
        </div>

        {/* Right: view action (file is already in storage) */}
        {item.fileUrl ? (
          <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" tabIndex={-1}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
              title="View file"
              aria-label="View file"
            >
              <EyeIcon className="size-3.5" />
            </Button>
          </a>
        ) : null}
      </div>
    </div>
  )
}

// ─── Document type section ────────────────────────────────────────────────────

function EssDocumentTypeSection({
  docType,
  serverCards,
  pendingItems,
  employeeId,
  queuedDocs,
  onQueued,
  onRemoveQueued,
}: {
  docType: DocumentTypeTabItem
  serverCards: DocumentVersionCard[]
  pendingItems: PendingDocumentItem[]
  employeeId: string
  queuedDocs: QueuedDocument[]
  onQueued: (doc: QueuedDocument) => void
  onRemoveQueued: (clientId: string) => void
}) {
  const [uploadOpen, setUploadOpen] = useState(false)

  // Total visible file count across all states
  const fileCount = serverCards.length + pendingItems.length + queuedDocs.length
  const isEmpty = fileCount === 0

  // Upload is blocked when allow_multiple is false and any doc already exists
  // in any state (approved, pending approval, or locally queued).
  const uploadBlocked =
    !docType.allow_multiple && (serverCards.length > 0 || pendingItems.length > 0 || queuedDocs.length > 0)

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
            {pendingItems.length > 0 ? (
              <span className="ml-1 text-amber-600">
                ({pendingItems.length} awaiting approval)
              </span>
            ) : null}
            {queuedDocs.length > 0 ? (
              <span className="ml-1 text-blue-600">
                ({queuedDocs.length} queued)
              </span>
            ) : null}
          </p>
        </div>

        {uploadBlocked ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title="Only one document allowed for this type. Remove the existing document or wait for HR to process the pending one."
            aria-label="Upload disabled — one document already exists for this type"
            className="cursor-not-allowed opacity-50"
          >
            <UploadIcon className="mr-1.5 size-3" />
            Upload
          </Button>
        ) : (
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
        )}
      </div>

      {/* Body */}
      <div className="border-t p-3 sm:p-4">
        <div className="space-y-2">
          {/* Upload form — at the top when open */}
          {uploadOpen && !uploadBlocked ? (
            <EssUploadForm
              docType={docType}
              onCancel={() => setUploadOpen(false)}
              onQueued={(doc) => {
                onQueued(doc)
              }}
            />
          ) : null}

          {isEmpty && docType.is_required && !uploadOpen ? (
            <div className="rounded-md border border-dashed bg-muted/10 p-4 text-center">
              <p className="text-sm font-medium">No file uploaded yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                This required document type needs at least one uploaded file.
              </p>
            </div>
          ) : null}

          {isEmpty && !docType.is_required && !uploadOpen ? (
            <div className="rounded-md border border-dashed bg-muted/10 p-3 text-center">
              <p className="text-xs text-muted-foreground">No files uploaded for this type.</p>
            </div>
          ) : null}

          {/* Locally queued — staged in memory, not yet submitted */}
          {queuedDocs.map((doc) => (
            <EssQueuedCard
              key={doc.clientId}
              doc={doc}
              onRemove={() => onRemoveQueued(doc.clientId)}
            />
          ))}

          {/* Submitted and awaiting HR approval */}
          {pendingItems.map((item) => (
            <EssPendingDocumentCard key={item.approvalItemId} item={item} />
          ))}

          {/* HR-approved, fully persisted documents */}
          {serverCards.map((card) => (
            <EssFileCard key={card.versionId} card={card} employeeId={employeeId} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function EssDocumentsTabSkeleton() {
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

// ─── Main ESS documents tab ───────────────────────────────────────────────────

function EssDocumentsTab({
  employeeId,
  queuedDocs,
  onQueued,
  onRemoveQueued,
  refreshToken,
}: {
  employeeId: string
  queuedDocs: QueuedDocument[]
  onQueued: (doc: QueuedDocument) => void
  onRemoveQueued: (clientId: string) => void
  /** Increment to trigger a re-fetch (e.g. after a successful submission). */
  refreshToken: number
}) {
  const [payload, setPayload] = useState<EmployeeDocumentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!employeeId) return
    let cancelled = false

    // Show a non-blocking refresh (keep stale data visible while re-fetching)
    // only when this is a subsequent load, not the initial mount.
    if (refreshToken > 0) {
      setFetchError(null)
    } else {
      setLoading(true)
    }

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
  }, [employeeId, refreshToken])

  if (loading) return <EssDocumentsTabSkeleton />

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

  const cardsByTypeId = new Map<string, DocumentVersionCard[]>()
  for (const card of payload.versionCards) {
    const existing = cardsByTypeId.get(card.documentTypeId)
    if (existing) {
      existing.push(card)
    } else {
      cardsByTypeId.set(card.documentTypeId, [card])
    }
  }

  const pendingByTypeId = new Map<string, PendingDocumentItem[]>()
  for (const item of payload.pendingDocumentItems ?? []) {
    const existing = pendingByTypeId.get(item.documentTypeId)
    if (existing) {
      existing.push(item)
    } else {
      pendingByTypeId.set(item.documentTypeId, [item])
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/20 px-3 py-2">
        <p className="text-sm font-medium">Employee Documents</p>
        <p className="text-xs text-muted-foreground">
          Supported formats: PDF, DOCX, PNG, JPEG, JPG
        </p>
      </div>

      {payload.documentTypes.map((docType) => (
        <EssDocumentTypeSection
          key={docType.id}
          docType={docType}
          serverCards={cardsByTypeId.get(docType.id) ?? []}
          pendingItems={pendingByTypeId.get(docType.id) ?? []}
          employeeId={employeeId}
          queuedDocs={queuedDocs.filter((d) => d.documentTypeId === docType.id)}
          onQueued={onQueued}
          onRemoveQueued={onRemoveQueued}
        />
      ))}
    </div>
  )
}

const PERSONAL_SECTIONS = [
  {
    id: 'identity',
    title: 'Identity',
    fieldKeys: [
      'employee_biodata.title',
      'employee_biodata.firstname',
      'employee_biodata.lastname',
      'employee_biodata.othernames',
      'employee_biodata.gender',
      'employee_biodata.date_of_birth',
    ],
  },
  {
    id: 'origin',
    title: 'Origin',
    fieldKeys: [
      'employee_biodata.place_of_birth',
      'employee_biodata.lga',
      'employee_biodata.state',
      'employee_biodata.country',
    ],
  },
  {
    id: 'family_background',
    title: 'Family background',
    fieldKeys: [
      'employee_biodata.marital_status',
      'employee_biodata.religion',
      'employee_biodata.mothers_maiden_name',
      'employee_biodata.ethnic_group',
      'employee_biodata.spouse',
      'employee_biodata.spouse_phone',
      'employee_biodata.number_of_kids',
    ],
  },
  {
    id: 'health',
    title: 'Health',
    fieldKeys: [
      'employee_biodata.blood_group',
      'employee_biodata.genotype',
      'employee_biodata.allergies',
      'employee_biodata.medical_history',
    ],
  },
] as const

const CONTACT_SECTIONS = [
  {
    id: 'contact_details',
    title: 'Contact details',
    fieldKeys: [
      'employees.email',
      'employees.phone',
      'employee_biodata.alternate_phone',
      'employee_biodata.alternate_email',
    ],
  },
  {
    id: 'residential_address_contact',
    title: 'Residential address',
    fieldKeys: [
      'employee_address.residential_address',
      'employee_address.nearest_bus_stop',
      'employee_address.nearest_landmark',
      'employee_address.city',
      'employee_address.state',
      'employee_address.country',
    ],
  },
] as const

const FINANCE_SECTIONS = [
  {
    id: 'bank_finance',
    title: 'Bank & Finance',
    fieldKeys: [
      'employee_bank_details.bank_name',
      'employee_bank_details.account_name',
      'employee_bank_details.account_number',
      'employee_bank_details.account_type',
      'employee_bank_details.bvn',
      'employee_bank_details.nin',
      'employee_bank_details.pfa',
      'employee_bank_details.rsa_pin',
      'employee_bank_details.tax_id',
      'employee_bank_details.nhf_id',
    ],
  },
] as const

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
]

const NIGERIA_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT (Abuja)', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
  'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara',
]

const NIGERIA_COUNTRY_OPTIONS = [{ value: 'Nigeria', label: 'Nigeria' }]

const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((v) => ({
  value: v,
  label: v,
}))

const GENOTYPE_OPTIONS = ['AA', 'AS', 'SS', 'AC'].map((v) => ({ value: v, label: v }))

const RELIGION_OPTIONS = ['Christianity', 'Islam', 'Traditional', 'Other'].map((v) => ({
  value: v,
  label: v,
}))

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'savings', label: 'Savings' },
  { value: 'current', label: 'Current' },
]

const SELECT_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  'employee_biodata.gender': GENDER_OPTIONS,
  'employee_biodata.marital_status': MARITAL_STATUS_OPTIONS,
  'employee_biodata.blood_group': BLOOD_GROUP_OPTIONS,
  'employee_biodata.genotype': GENOTYPE_OPTIONS,
  'employee_biodata.religion': RELIGION_OPTIONS,
  'employee_biodata.state': NIGERIA_STATES.map((s) => ({ value: s, label: s })),
  'employee_biodata.country': NIGERIA_COUNTRY_OPTIONS,
  'employee_address.state': NIGERIA_STATES.map((s) => ({ value: s, label: s })),
  'employee_address.country': NIGERIA_COUNTRY_OPTIONS,
  'employee_bank_details.account_type': ACCOUNT_TYPE_OPTIONS,
}

const DATE_FIELDS = new Set(['employee_biodata.date_of_birth'])
const NUMBER_FIELDS = new Set(['employee_biodata.number_of_kids'])

// Per-field customizable placeholders, keyed by field_key.
// Falls back to the field label when not specified.
const PLACEHOLDERS: Record<string, string> = {
  // Personal – identity
  'employee_biodata.title': 'Mr / Mrs / Dr',
  'employee_biodata.firstname': 'Input your first name',
  'employee_biodata.lastname': 'Input your last name',
  'employee_biodata.othernames': 'Input your last name',
  'employee_biodata.gender': 'Select gender',
  'employee_biodata.date_of_birth': 'Select date of birth',

  // Personal – origin
  'employee_biodata.place_of_birth': 'City / town of birth',
  'employee_biodata.lga': 'Local government area',
  'employee_biodata.state': 'Select state of origin',
  'employee_biodata.country': 'Country of origin',

  // Personal – family background
  'employee_biodata.marital_status': 'Select marital status',
  'employee_biodata.religion': 'Select religion',
  'employee_biodata.mothers_maiden_name': "Mother's maiden name",
  'employee_biodata.ethnic_group': 'Ethnic group',
  'employee_biodata.spouse': "Spouse's name",
  'employee_biodata.spouse_phone': "Spouse's phone number",
  'employee_biodata.number_of_kids': 'Number of children',

  // Personal – health
  'employee_biodata.blood_group': 'Select blood group',
  'employee_biodata.genotype': 'Select genotype',
  'employee_biodata.allergies': 'List any allergies',
  'employee_biodata.medical_history': 'Brief medical history / conditions',

  // Contact – contact details
  'employees.email': 'Add company email address',
  'employees.phone': 'Add primary phone number',
  'employee_biodata.alternate_phone': 'Add alternate phone number',
  'employee_biodata.alternate_email': 'Add alternate email address',

  // Contact / Finance – residential address
  'employee_address.residential_address': 'Street address',
  'employee_address.nearest_bus_stop': 'Nearest bus stop',
  'employee_address.nearest_landmark': 'Nearest landmark',
  'employee_address.city': 'City',
  'employee_address.state': 'State / region',
  'employee_address.country': 'Country',

  // Finance – bank & finance
  'employee_bank_details.bank_name': 'Bank name',
  'employee_bank_details.account_name': 'Account name',
  'employee_bank_details.account_number': '10-digit account number',
  'employee_bank_details.account_type': 'Select account type',
  'employee_bank_details.bvn': '11-digit BVN (optional)',
  'employee_bank_details.nin': '11-digit NIN (optional)',
  'employee_bank_details.pfa': 'Pension Fund Administrator (PFA)',
  'employee_bank_details.rsa_pin': 'Retirement Savings Account (RSA) PIN',
  'employee_bank_details.tax_id': 'Tax Identification Number (TIN)',
  'employee_bank_details.nhf_id': 'NHF ID (optional)',
}

const INPUT_BASE =
  'h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm w-full focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'

const SELECT_BASE =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'

const NEXT_OF_KIN_PURPOSE_OPTIONS = [
  { value: 'Benefit', label: 'Benefit' },
  { value: 'Emergency', label: 'Emergency' },
  { value: 'Benefit and Emergency', label: 'Benefit and Emergency' },
] as const

type FieldDef = {
  field_key: string
  label: string
  can_read: boolean
  can_write: boolean
}

type DraftRecord = RecordCreateRequest & { clientId: string }

interface ProfileUpdateRequestFormProps {
  schema: ProfileSchema
  initialValues: Record<string, unknown>
  pendingFields: string[]
  collections: EmployeeCollectionsForEss
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

function initializeFormValues(initialValues: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(initialValues)) out[k] = toStr(v)
  // Default all country fields to Nigeria when empty
  const countryKeys = ['employee_biodata.country', 'employee_address.country']
  for (const key of countryKeys) {
    if (!out[key] || out[key].trim() === '') {
      out[key] = 'Nigeria'
    }
  }
  return out
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return d
  }
}

function FL({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted-foreground">{children}</label>
}

function FieldItem({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium leading-snug">{value && value !== '' ? value : '—'}</p>
    </div>
  )
}

function PendingRequestBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
      Pending approval from HR
    </span>
  )
}

function DraftBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
      Ready to submit
    </span>
  )
}

function SectionHeader({
  title,
  onAdd,
}: {
  title: string
  onAdd: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold">{title}</h3>
      <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={onAdd}>
        <PlusIcon className="size-3" /> Add
      </Button>
    </div>
  )
}

function PendingCreateSummary({
  pendingRecords,
}: {
  pendingRecords: PendingRecordCreate[]
}) {
  if (pendingRecords.length === 0) return null
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50/50 px-3 py-2 text-xs text-amber-800">
      {pendingRecords.length} pending {pendingRecords.length === 1 ? 'record request' : 'record requests'} awaiting HR approval.
    </div>
  )
}

function buildFieldMap(schema: ProfileSchema) {
  const map = new Map<string, FieldDef>()
  for (const fields of Object.values(schema)) {
    for (const field of fields) map.set(field.field_key, field)
  }
  return map
}

function renderScalarInput(args: {
  field: FieldDef
  formValues: Record<string, string>
  initialValues: Record<string, unknown>
  pendingSet: Set<string>
  onChange: (fieldKey: string, value: string) => void
}) {
  const { field, formValues, initialValues, pendingSet, onChange } = args
  const fieldKey = field.field_key
  const isFieldPending = pendingSet.has(fieldKey)
  const isWritable = field.can_write && !isFieldPending
  const currentValue = formValues[fieldKey] ?? ''
  const originalValue = toStr(initialValues[fieldKey])
  const isDirty = isWritable && currentValue !== originalValue
  const selectOpts = SELECT_OPTIONS[fieldKey]
  const isDate = DATE_FIELDS.has(fieldKey)
  const isNumber = NUMBER_FIELDS.has(fieldKey)
  const placeholder = PLACEHOLDERS[fieldKey] ?? field.label

  return (
    <div key={fieldKey} className="space-y-1">
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
        {isDirty ? (
          <span className="text-[9px] font-semibold uppercase tracking-wide text-primary">changed</span>
        ) : null}
      </div>

      {selectOpts ? (
        <select
          value={currentValue}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          disabled={!isWritable}
          aria-label={field.label}
          className={cn(
            SELECT_BASE,
            'disabled:cursor-not-allowed disabled:bg-muted/30 disabled:opacity-60',
            isFieldPending && 'border-amber-300 bg-amber-50/40',
            isDirty && !isFieldPending && 'border-primary/50'
          )}
        >
          <option value="">Select…</option>
          {selectOpts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <Input
          type={isDate ? 'date' : isNumber ? 'number' : 'text'}
          value={currentValue}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          disabled={!isWritable}
          aria-label={field.label}
          placeholder={isDate ? (placeholder || 'Select date') : placeholder}
          className={cn(
            INPUT_BASE,
            'disabled:cursor-not-allowed disabled:bg-muted/30 disabled:opacity-60',
            isFieldPending && 'border-amber-300 bg-amber-50/40',
            isDirty && !isFieldPending && 'border-primary/50'
          )}
        />
      )}

      {isFieldPending ? (
        <p className="text-[11px] font-medium text-amber-600">Pending approval from HR</p>
      ) : null}
    </div>
  )
}

function ScalarSectionCard({
  title,
  fieldKeys,
  fieldByKey,
  formValues,
  initialValues,
  pendingSet,
  onChange,
}: {
  title: string
  fieldKeys: readonly string[]
  fieldByKey: Map<string, FieldDef>
  formValues: Record<string, string>
  initialValues: Record<string, unknown>
  pendingSet: Set<string>
  onChange: (fieldKey: string, value: string) => void
}) {
  const visibleFields = fieldKeys
    .map((key) => fieldByKey.get(key))
    .filter((field): field is FieldDef => !!field?.can_read)

  if (visibleFields.length === 0) return null

  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        {visibleFields.map((field) =>
          renderScalarInput({
            field,
            formValues,
            initialValues,
            pendingSet,
            onChange,
          })
        )}
      </div>
    </div>
  )
}

const personSchema = z.object({
  title: z.string().max(20, 'Too long'),
  first_name: z.string().min(1, 'First name is required').max(100, 'Too long'),
  last_name: z.string().min(1, 'Last name is required').max(100, 'Too long'),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .refine((v) => /^\+?[\d\s\-(). ]{7,20}$/.test(v), { message: 'Invalid phone number' }),
  email: z.string().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
    message: 'Invalid email address',
  }),
  relationship: z.string().min(1, 'Relationship is required').max(100, 'Too long'),
  address: z.string().min(1, 'Address is required').max(255, 'Too long'),
})

type PersonForm = z.infer<typeof personSchema>

const nextOfKinSchema = personSchema.extend({
  purpose: z
    .string()
    .min(1, 'Purpose is required')
    .refine((v) => ['Benefit', 'Emergency', 'Benefit and Emergency'].includes(v), {
      message: 'Please select Benefit, Emergency, or Benefit and Emergency',
    }),
})

type NextOfKinForm = z.infer<typeof nextOfKinSchema>

const experienceSchema = z
  .object({
    company: z.string().min(1, 'Company is required').max(150, 'Too long'),
    position: z.string().min(1, 'Position / title is required').max(150, 'Too long'),
    phone: z.string().refine((v) => !v || /^\+?[\d\s\-(). ]{7,20}$/.test(v), {
      message: 'Invalid phone number',
    }),
    email: z.string().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: 'Invalid email address',
    }),
    address: z.string().min(1, 'Company address is required').max(255, 'Too long'),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string(),
    reason_for_leaving: z.string().max(255, 'Too long'),
  })
  .refine((d) => !d.end_date || new Date(d.end_date) >= new Date(d.start_date), {
    message: 'End date must not be before start date',
    path: ['end_date'],
  })

type ExperienceForm = z.infer<typeof experienceSchema>

const educationSchema = z
  .object({
    school: z.string().min(1, 'School / institution is required').max(150, 'Too long'),
    course: z.string().min(1, 'Course / field of study is required').max(150, 'Too long'),
    degree: z.string().min(1, 'Degree / qualification is required').max(100, 'Too long'),
    grade: z.string().max(50, 'Too long'),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string(),
  })
  .refine((d) => !d.end_date || new Date(d.end_date) >= new Date(d.start_date), {
    message: 'End date must not be before start date',
    path: ['end_date'],
  })

type EducationForm = z.infer<typeof educationSchema>

const trainingSchema = z
  .object({
    institution: z.string().min(1, 'Institution is required').max(150, 'Too long'),
    course: z.string().min(1, 'Course / training is required').max(150, 'Too long'),
    license_name: z.string().max(150, 'Too long'),
    issuing_body: z.string().max(150, 'Too long'),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string(),
  })
  .refine((d) => !d.end_date || new Date(d.end_date) >= new Date(d.start_date), {
    message: 'End date must not be before start date',
    path: ['end_date'],
  })

type TrainingForm = z.infer<typeof trainingSchema>

function PersonCard({
  title,
  first_name,
  last_name,
  phone,
  email,
  relationship,
  address,
  badge,
  onRemove,
}: {
  title?: string | null
  first_name: string
  last_name: string
  phone: string
  email?: string | null
  relationship: string
  address: string
  badge?: React.ReactNode
  onRemove?: () => void
}) {
  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {title ? `${title} ` : ''}
            {first_name} {last_name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{relationship}</p>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {onRemove ? (
            <Button variant="ghost" size="icon" className="size-7" onClick={onRemove}>
              <Trash2Icon className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 border-t pt-1 sm:grid-cols-2">
        <FieldItem label="Phone" value={phone} />
        <FieldItem label="Email" value={email ?? null} />
        <FieldItem label="Relationship" value={relationship} />
        <FieldItem label="Address" value={address} />
      </div>
    </div>
  )
}

function NextOfKinCard({
  rec,
  badge,
  onRemove,
}: {
  rec: NextOfKinForm | NextOfKinRecord
  badge?: React.ReactNode
  onRemove?: () => void
}) {
  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {rec.title ? `${rec.title} ` : ''}
            {rec.first_name} {rec.last_name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{rec.relationship}</p>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {onRemove ? (
            <Button variant="ghost" size="icon" className="size-7" onClick={onRemove}>
              <Trash2Icon className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 border-t pt-1 sm:grid-cols-2">
        <FieldItem label="Phone" value={rec.phone} />
        <FieldItem label="Email" value={rec.email ?? null} />
        <FieldItem label="Purpose" value={rec.purpose} />
        <FieldItem label="Address" value={rec.address} />
      </div>
    </div>
  )
}

function ExperienceCard({
  rec,
  badge,
  onRemove,
}: {
  rec: ExperienceForm | ExperienceRecord
  badge?: React.ReactNode
  onRemove?: () => void
}) {
  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{rec.company}</p>
          <p className="truncate text-xs text-muted-foreground">{rec.position}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {fmtDate(rec.start_date)} - {rec.end_date ? fmtDate(rec.end_date) : 'Present'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {onRemove ? (
            <Button variant="ghost" size="icon" className="size-7" onClick={onRemove}>
              <Trash2Icon className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 border-t pt-1 sm:grid-cols-2">
        <FieldItem label="Company phone" value={rec.phone ?? null} />
        <FieldItem label="Company email" value={rec.email ?? null} />
        <FieldItem label="Company address" value={rec.address} />
        <FieldItem label="Reason for leaving" value={rec.reason_for_leaving ?? null} />
      </div>
    </div>
  )
}

function EducationCard({
  rec,
  badge,
  onRemove,
}: {
  rec: EducationForm | EducationRecord
  badge?: React.ReactNode
  onRemove?: () => void
}) {
  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{rec.school}</p>
          <p className="truncate text-xs text-muted-foreground">
            {rec.degree}
            {rec.course ? ` · ${rec.course}` : ''}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {fmtDate(rec.start_date)} - {rec.end_date ? fmtDate(rec.end_date) : 'Present'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {onRemove ? (
            <Button variant="ghost" size="icon" className="size-7" onClick={onRemove}>
              <Trash2Icon className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>
      {rec.grade ? (
        <div className="border-t pt-1">
          <FieldItem label="Grade / Class" value={rec.grade} />
        </div>
      ) : null}
    </div>
  )
}

function TrainingCard({
  rec,
  badge,
  onRemove,
}: {
  rec: TrainingForm | TrainingRecord
  badge?: React.ReactNode
  onRemove?: () => void
}) {
  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{rec.course}</p>
          <p className="truncate text-xs text-muted-foreground">{rec.institution}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {fmtDate(rec.start_date)} - {rec.end_date ? fmtDate(rec.end_date) : 'No expiry'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {onRemove ? (
            <Button variant="ghost" size="icon" className="size-7" onClick={onRemove}>
              <Trash2Icon className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>
      {rec.license_name || rec.issuing_body ? (
        <div className="grid grid-cols-1 gap-2 border-t pt-1 sm:grid-cols-2">
          <FieldItem label="Licence / Certificate" value={rec.license_name ?? null} />
          <FieldItem label="Issuing body" value={rec.issuing_body ?? null} />
        </div>
      ) : null}
    </div>
  )
}

function PersonCreateSection({
  title,
  table,
  records,
  pendingRecords,
  draftRecords,
  onAddDraft,
  onRemoveDraft,
}: {
  title: string
  table: 'employee_family' | 'employee_dependants'
  records: PersonRecord[]
  pendingRecords: PendingRecordCreate[]
  draftRecords: DraftRecord[]
  onAddDraft: (record: RecordCreateRequest) => void
  onRemoveDraft: (clientId: string) => void
}) {
  const empty: PersonForm = {
    title: '',
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    relationship: '',
    address: '',
  }
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<PersonForm>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof PersonForm, string>>>({})

  const s = (k: keyof PersonForm) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setErrors((p) => ({ ...p, [k]: undefined }))
  }

  const handleSave = () => {
    const result = personSchema.safeParse(form)
    if (!result.success) {
      const nextErrors: Partial<Record<keyof PersonForm, string>> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof PersonForm
        if (!nextErrors[key]) nextErrors[key] = issue.message
      }
      setErrors(nextErrors)
      return
    }
    onAddDraft({ table, payload: result.data })
    setForm(empty)
    setErrors({})
    setAdding(false)
    toast.success(`${title} queued for HR approval`)
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <SectionHeader title={title} onAdd={() => { setForm(empty); setErrors({}); setAdding(true) }} />
      <PendingCreateSummary pendingRecords={pendingRecords} />

      {adding ? (
        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1"><FL>Title</FL><Input value={form.title} onChange={(e) => s('title')(e.target.value)} className={INPUT_BASE} placeholder="Mr / Mrs / Dr" /></div>
            <div className="space-y-1"><FL>First name</FL><Input value={form.first_name} onChange={(e) => s('first_name')(e.target.value)} className={cn(INPUT_BASE, errors.first_name && 'border-destructive')} placeholder="Add first name" />{errors.first_name ? <p className="ml-1 text-xs text-destructive">{errors.first_name}</p> : null}</div>
            <div className="space-y-1"><FL>Last name</FL><Input value={form.last_name} onChange={(e) => s('last_name')(e.target.value)} className={cn(INPUT_BASE, errors.last_name && 'border-destructive')} placeholder="Add last name" />{errors.last_name ? <p className="ml-1 text-xs text-destructive">{errors.last_name}</p> : null}</div>
            <div className="space-y-1"><FL>Phone</FL><Input value={form.phone} onChange={(e) => s('phone')(e.target.value)} className={cn(INPUT_BASE, errors.phone && 'border-destructive')} placeholder="Add phone number" />{errors.phone ? <p className="ml-1 text-xs text-destructive">{errors.phone}</p> : null}</div>
            <div className="space-y-1"><FL>Email</FL><Input value={form.email} onChange={(e) => s('email')(e.target.value)} className={cn(INPUT_BASE, errors.email && 'border-destructive')} placeholder='Add email address' />{errors.email ? <p className="ml-1 text-xs text-destructive">{errors.email}</p> : null}</div>
            <div className="space-y-1"><FL>Relationship</FL><Input value={form.relationship} onChange={(e) => s('relationship')(e.target.value)} className={cn(INPUT_BASE, errors.relationship && 'border-destructive')} placeholder="Your relationship with this person?" />{errors.relationship ? <p className="ml-1 text-xs text-destructive">{errors.relationship}</p> : null}</div>
            <div className="space-y-1 sm:col-span-2"><FL>Address</FL><Input value={form.address} onChange={(e) => s('address')(e.target.value)} className={cn(INPUT_BASE, errors.address && 'border-destructive')} placeholder="Add person's residential address" />{errors.address ? <p className="ml-1 text-xs text-destructive">{errors.address}</p> : null}</div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)} className="h-7 px-2 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleSave} className="h-7 px-2 text-xs gap-1"><PlusIcon className="size-3" /> Add Person</Button>
          </div>
        </div>
      ) : null}

      {records.length === 0 && pendingRecords.length === 0 && draftRecords.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground">No records yet.</p>
      ) : null}

      {records.map((rec) => (
        <PersonCard key={rec.id} {...rec} />
      ))}
      {pendingRecords.map((rec) => (
        <PersonCard key={rec.id} {...(rec.payload as PersonForm)} badge={<PendingRequestBadge />} />
      ))}
      {draftRecords.map((rec) => (
        <PersonCard key={rec.clientId} {...(rec.payload as PersonForm)} badge={<DraftBadge />} onRemove={() => onRemoveDraft(rec.clientId)} />
      ))}
    </div>
  )
}

function NextOfKinCreateSection({
  records,
  pendingRecords,
  draftRecords,
  onAddDraft,
  onRemoveDraft,
}: {
  records: NextOfKinRecord[]
  pendingRecords: PendingRecordCreate[]
  draftRecords: DraftRecord[]
  onAddDraft: (record: RecordCreateRequest) => void
  onRemoveDraft: (clientId: string) => void
}) {
  const empty: NextOfKinForm = {
    title: '',
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    relationship: '',
    purpose: '',
    address: '',
  }
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<NextOfKinForm>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof NextOfKinForm, string>>>({})

  const s = (k: keyof NextOfKinForm) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setErrors((p) => ({ ...p, [k]: undefined }))
  }

  const handleSave = () => {
    const result = nextOfKinSchema.safeParse(form)
    if (!result.success) {
      const nextErrors: Partial<Record<keyof NextOfKinForm, string>> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof NextOfKinForm
        if (!nextErrors[key]) nextErrors[key] = issue.message
      }
      setErrors(nextErrors)
      return
    }
    onAddDraft({ table: 'employee_next_of_kin', payload: result.data })
    setForm(empty)
    setErrors({})
    setAdding(false)
    toast.success('Next of kin record queued for HR approval')
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <SectionHeader title="Next of kin records" onAdd={() => { setForm(empty); setErrors({}); setAdding(true) }} />
      <PendingCreateSummary pendingRecords={pendingRecords} />

      {adding ? (
        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1"><FL>Title</FL><Input value={form.title} onChange={(e) => s('title')(e.target.value)} className={INPUT_BASE} placeholder="Mr / Mrs / Dr" /></div>
            <div className="space-y-1"><FL>First name</FL><Input value={form.first_name} onChange={(e) => s('first_name')(e.target.value)} className={cn(INPUT_BASE, errors.first_name && 'border-destructive')} placeholder="Add first name" />{errors.first_name ? <p className="ml-1 text-xs text-destructive">{errors.first_name}</p> : null}</div>
            <div className="space-y-1"><FL>Last name</FL><Input value={form.last_name} onChange={(e) => s('last_name')(e.target.value)} className={cn(INPUT_BASE, errors.last_name && 'border-destructive')} placeholder="Add last name" />{errors.last_name ? <p className="ml-1 text-xs text-destructive">{errors.last_name}</p> : null}</div>
            <div className="space-y-1"><FL>Email</FL><Input value={form.email} onChange={(e) => s('email')(e.target.value)} className={cn(INPUT_BASE, errors.email && 'border-destructive')} placeholder="Add email address" />{errors.email ? <p className="ml-1 text-xs text-destructive">{errors.email}</p> : null}</div>
            <div className="space-y-1"><FL>Phone</FL><Input value={form.phone} onChange={(e) => s('phone')(e.target.value)} className={cn(INPUT_BASE, errors.phone && 'border-destructive')} placeholder="Add phone number" />{errors.phone ? <p className="ml-1 text-xs text-destructive">{errors.phone}</p> : null}</div>
            <div className="space-y-1"><FL>Relationship</FL><Input value={form.relationship} onChange={(e) => s('relationship')(e.target.value)} className={cn(INPUT_BASE, errors.relationship && 'border-destructive')} placeholder="Your relationship with this person?" />{errors.relationship ? <p className="ml-1 text-xs text-destructive">{errors.relationship}</p> : null}</div>
            <div className="space-y-1">
              <FL>Purpose</FL>
              <select
                value={form.purpose}
                onChange={(e) => s('purpose')(e.target.value)}
                aria-label="Purpose"
                className={cn(SELECT_BASE, errors.purpose && 'border-destructive')}
              >
                <option value="">Select…</option>
                {NEXT_OF_KIN_PURPOSE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {errors.purpose ? <p className="ml-1 text-xs text-destructive">{errors.purpose}</p> : null}
            </div>
            <div className="space-y-1 sm:col-span-2"><FL>Address</FL><Input value={form.address} onChange={(e) => s('address')(e.target.value)} className={cn(INPUT_BASE, errors.address && 'border-destructive')} placeholder="Add house address of next of kin" />{errors.address ? <p className="ml-1 text-xs text-destructive">{errors.address}</p> : null}</div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)} className="h-7 px-2 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleSave} className="h-7 px-2 text-xs gap-1"><PlusIcon className="size-3" /> Queue record</Button>
          </div>
        </div>
      ) : null}

      {records.length === 0 && pendingRecords.length === 0 && draftRecords.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground">No records yet.</p>
      ) : null}

      {records.map((rec) => (
        <NextOfKinCard key={rec.id} rec={rec} />
      ))}
      {pendingRecords.map((rec) => (
        <NextOfKinCard key={rec.id} rec={rec.payload as NextOfKinForm} badge={<PendingRequestBadge />} />
      ))}
      {draftRecords.map((rec) => (
        <NextOfKinCard key={rec.clientId} rec={rec.payload as NextOfKinForm} badge={<DraftBadge />} onRemove={() => onRemoveDraft(rec.clientId)} />
      ))}
    </div>
  )
}

function ExperienceCreateSection({
  records,
  pendingRecords,
  draftRecords,
  onAddDraft,
  onRemoveDraft,
}: {
  records: ExperienceRecord[]
  pendingRecords: PendingRecordCreate[]
  draftRecords: DraftRecord[]
  onAddDraft: (record: RecordCreateRequest) => void
  onRemoveDraft: (clientId: string) => void
}) {
  const empty: ExperienceForm = {
    company: '',
    position: '',
    phone: '',
    email: '',
    address: '',
    start_date: '',
    end_date: '',
    reason_for_leaving: '',
  }
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<ExperienceForm>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof ExperienceForm, string>>>({})

  const s = (k: keyof ExperienceForm) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setErrors((p) => ({ ...p, [k]: undefined }))
  }

  const handleSave = () => {
    const result = experienceSchema.safeParse(form)
    if (!result.success) {
      const nextErrors: Partial<Record<keyof ExperienceForm, string>> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof ExperienceForm
        if (!nextErrors[key]) nextErrors[key] = issue.message
      }
      setErrors(nextErrors)
      return
    }
    onAddDraft({ table: 'employee_experience', payload: result.data })
    setForm(empty)
    setErrors({})
    setAdding(false)
    toast.success('Work experience queued for HR approval')
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <SectionHeader title="Work experience records" onAdd={() => { setForm(empty); setErrors({}); setAdding(true) }} />
      <PendingCreateSummary pendingRecords={pendingRecords} />

      {adding ? (
        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1"><FL>Company</FL><Input value={form.company} onChange={(e) => s('company')(e.target.value)} className={cn(INPUT_BASE, errors.company && 'border-destructive')} placeholder='Add company name' />{errors.company ? <p className="ml-1 text-xs text-destructive">{errors.company}</p> : null}</div>
            <div className="space-y-1"><FL>Position / title</FL><Input value={form.position} onChange={(e) => s('position')(e.target.value)} className={cn(INPUT_BASE, errors.position && 'border-destructive')} placeholder='Add job title' />{errors.position ? <p className="ml-1 text-xs text-destructive">{errors.position}</p> : null}</div>
            <div className="space-y-1"><FL>Company phone</FL><Input value={form.phone} onChange={(e) => s('phone')(e.target.value)} className={cn(INPUT_BASE, errors.phone && 'border-destructive')} placeholder='Add company phone number' />{errors.phone ? <p className="ml-1 text-xs text-destructive">{errors.phone}</p> : null}</div>
            <div className="space-y-1"><FL>Company email</FL><Input value={form.email} onChange={(e) => s('email')(e.target.value)} className={cn(INPUT_BASE, errors.email && 'border-destructive')} placeholder='Add company email address' />{errors.email ? <p className="ml-1 text-xs text-destructive">{errors.email}</p> : null}</div>
            <div className="space-y-1 sm:col-span-2"><FL>Company address</FL><Input value={form.address} onChange={(e) => s('address')(e.target.value)} className={cn(INPUT_BASE, errors.address && 'border-destructive')} placeholder='Add company address' />{errors.address ? <p className="ml-1 text-xs text-destructive">{errors.address}</p> : null}</div>
            <div className="space-y-1"><FL>Start date</FL><Input type="date" value={form.start_date} onChange={(e) => s('start_date')(e.target.value)} className={cn(INPUT_BASE, errors.start_date && 'border-destructive')} placeholder='Select start date' />{errors.start_date ? <p className="ml-1 text-xs text-destructive">{errors.start_date}</p> : null}</div>
            <div className="space-y-1"><FL>End date</FL><Input type="date" value={form.end_date} onChange={(e) => s('end_date')(e.target.value)} className={cn(INPUT_BASE, errors.end_date && 'border-destructive')} placeholder='Select end date' />{errors.end_date ? <p className="ml-1 text-xs text-destructive">{errors.end_date}</p> : null}</div>
            <div className="space-y-1 sm:col-span-2"><FL>Reason for leaving</FL><Input value={form.reason_for_leaving} onChange={(e) => s('reason_for_leaving')(e.target.value)} className={cn(INPUT_BASE, errors.reason_for_leaving && 'border-destructive')} placeholder='Reason for leaving the company' />{errors.reason_for_leaving ? <p className="ml-1 text-xs text-destructive">{errors.reason_for_leaving}</p> : null}</div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)} className="h-7 px-2 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleSave} className="h-7 px-2 text-xs gap-1"><PlusIcon className="size-3" /> Add Experience</Button>
          </div>
        </div>
      ) : null}

      {records.length === 0 && pendingRecords.length === 0 && draftRecords.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground">No experience records yet.</p>
      ) : null}

      {records.map((rec) => (
        <ExperienceCard key={rec.id} rec={rec} />
      ))}
      {pendingRecords.map((rec) => (
        <ExperienceCard key={rec.id} rec={rec.payload as ExperienceForm} badge={<PendingRequestBadge />} />
      ))}
      {draftRecords.map((rec) => (
        <ExperienceCard key={rec.clientId} rec={rec.payload as ExperienceForm} badge={<DraftBadge />} onRemove={() => onRemoveDraft(rec.clientId)} />
      ))}
    </div>
  )
}

function EducationCreateSection({
  records,
  pendingRecords,
  draftRecords,
  onAddDraft,
  onRemoveDraft,
}: {
  records: EducationRecord[]
  pendingRecords: PendingRecordCreate[]
  draftRecords: DraftRecord[]
  onAddDraft: (record: RecordCreateRequest) => void
  onRemoveDraft: (clientId: string) => void
}) {
  const empty: EducationForm = {
    school: '',
    course: '',
    degree: '',
    grade: '',
    start_date: '',
    end_date: '',
  }
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<EducationForm>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof EducationForm, string>>>({})

  const s = (k: keyof EducationForm) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setErrors((p) => ({ ...p, [k]: undefined }))
  }

  const handleSave = () => {
    const result = educationSchema.safeParse(form)
    if (!result.success) {
      const nextErrors: Partial<Record<keyof EducationForm, string>> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof EducationForm
        if (!nextErrors[key]) nextErrors[key] = issue.message
      }
      setErrors(nextErrors)
      return
    }
    onAddDraft({ table: 'employee_education', payload: result.data })
    setForm(empty)
    setErrors({})
    setAdding(false)
    toast.success('Education record queued for HR approval')
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <SectionHeader title="Education records" onAdd={() => { setForm(empty); setErrors({}); setAdding(true) }} />
      <PendingCreateSummary pendingRecords={pendingRecords} />

      {adding ? (
        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1"><FL>School / institution</FL><Input value={form.school} onChange={(e) => s('school')(e.target.value)} className={cn(INPUT_BASE, errors.school && 'border-destructive')} placeholder='Add school name' />{errors.school ? <p className="ml-1 text-xs text-destructive">{errors.school}</p> : null}</div>
            <div className="space-y-1"><FL>Course / field of study</FL><Input value={form.course} onChange={(e) => s('course')(e.target.value)} className={cn(INPUT_BASE, errors.course && 'border-destructive')} placeholder='Add course name' />{errors.course ? <p className="ml-1 text-xs text-destructive">{errors.course}</p> : null}</div>
            <div className="space-y-1"><FL>Degree / qualification</FL><Input value={form.degree} onChange={(e) => s('degree')(e.target.value)} className={cn(INPUT_BASE, errors.degree && 'border-destructive')} placeholder='Add degree name' />{errors.degree ? <p className="ml-1 text-xs text-destructive">{errors.degree}</p> : null}</div>
            <div className="space-y-1"><FL>Grade / class</FL><Input value={form.grade} onChange={(e) => s('grade')(e.target.value)} className={cn(INPUT_BASE, errors.grade && 'border-destructive')} placeholder='Add grade' />{errors.grade ? <p className="ml-1 text-xs text-destructive">{errors.grade}</p> : null}</div>
            <div className="space-y-1"><FL>Start date</FL><Input type="date" value={form.start_date} onChange={(e) => s('start_date')(e.target.value)} className={cn(INPUT_BASE, errors.start_date && 'border-destructive')} placeholder='Select start date' />{errors.start_date ? <p className="ml-1 text-xs text-destructive">{errors.start_date}</p> : null}</div>
            <div className="space-y-1"><FL>End date</FL><Input type="date" value={form.end_date} onChange={(e) => s('end_date')(e.target.value)} className={cn(INPUT_BASE, errors.end_date && 'border-destructive')} placeholder='Select end date' />{errors.end_date ? <p className="ml-1 text-xs text-destructive">{errors.end_date}</p> : null}</div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)} className="h-7 px-2 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleSave} className="h-7 px-2 text-xs gap-1"><PlusIcon className="size-3" /> Add Education</Button>
          </div>
        </div>
      ) : null}

      {records.length === 0 && pendingRecords.length === 0 && draftRecords.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground">No education records yet.</p>
      ) : null}

      {records.map((rec) => (
        <EducationCard key={rec.id} rec={rec} />
      ))}
      {pendingRecords.map((rec) => (
        <EducationCard key={rec.id} rec={rec.payload as EducationForm} badge={<PendingRequestBadge />} />
      ))}
      {draftRecords.map((rec) => (
        <EducationCard key={rec.clientId} rec={rec.payload as EducationForm} badge={<DraftBadge />} onRemove={() => onRemoveDraft(rec.clientId)} />
      ))}
    </div>
  )
}

function TrainingCreateSection({
  records,
  pendingRecords,
  draftRecords,
  onAddDraft,
  onRemoveDraft,
}: {
  records: TrainingRecord[]
  pendingRecords: PendingRecordCreate[]
  draftRecords: DraftRecord[]
  onAddDraft: (record: RecordCreateRequest) => void
  onRemoveDraft: (clientId: string) => void
}) {
  const empty: TrainingForm = {
    institution: '',
    course: '',
    license_name: '',
    issuing_body: '',
    start_date: '',
    end_date: '',
  }
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<TrainingForm>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof TrainingForm, string>>>({})

  const s = (k: keyof TrainingForm) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setErrors((p) => ({ ...p, [k]: undefined }))
  }

  const handleSave = () => {
    const result = trainingSchema.safeParse(form)
    if (!result.success) {
      const nextErrors: Partial<Record<keyof TrainingForm, string>> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof TrainingForm
        if (!nextErrors[key]) nextErrors[key] = issue.message
      }
      setErrors(nextErrors)
      return
    }
    onAddDraft({ table: 'employee_training', payload: result.data })
    setForm(empty)
    setErrors({})
    setAdding(false)
    toast.success('Training record queued for HR approval')
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <SectionHeader title="Training and certificates" onAdd={() => { setForm(empty); setErrors({}); setAdding(true) }} />
      <PendingCreateSummary pendingRecords={pendingRecords} />

      {adding ? (
        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1"><FL>Institution</FL><Input value={form.institution} onChange={(e) => s('institution')(e.target.value)} className={cn(INPUT_BASE, errors.institution && 'border-destructive')} placeholder='Add training provider name' />{errors.institution ? <p className="ml-1 text-xs text-destructive">{errors.institution}</p> : null}</div>
            <div className="space-y-1"><FL>Course / training</FL><Input value={form.course} onChange={(e) => s('course')(e.target.value)} className={cn(INPUT_BASE, errors.course && 'border-destructive')} placeholder='Add course name' />{errors.course ? <p className="ml-1 text-xs text-destructive">{errors.course}</p> : null}</div>
            <div className="space-y-1"><FL>Licence / certificate name</FL><Input value={form.license_name} onChange={(e) => s('license_name')(e.target.value)} className={INPUT_BASE} placeholder='Add license name' /></div>
            <div className="space-y-1"><FL>Issuing body</FL><Input value={form.issuing_body} onChange={(e) => s('issuing_body')(e.target.value)} className={INPUT_BASE} placeholder='Add issuing body' /></div>
            <div className="space-y-1"><FL>Start date</FL><Input type="date" value={form.start_date} onChange={(e) => s('start_date')(e.target.value)} className={cn(INPUT_BASE, errors.start_date && 'border-destructive')} placeholder='Select start date' />{errors.start_date ? <p className="ml-1 text-xs text-destructive">{errors.start_date}</p> : null}</div>
            <div className="space-y-1"><FL>End date / expiry</FL><Input type="date" value={form.end_date} onChange={(e) => s('end_date')(e.target.value)} className={cn(INPUT_BASE, errors.end_date && 'border-destructive')} placeholder='Select end date' />{errors.end_date ? <p className="ml-1 text-xs text-destructive">{errors.end_date}</p> : null}</div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)} className="h-7 px-2 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleSave} className="h-7 px-2 text-xs gap-1"><PlusIcon className="size-3" /> Add Training</Button>
          </div>
        </div>
      ) : null}

      {records.length === 0 && pendingRecords.length === 0 && draftRecords.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground">No training records yet.</p>
      ) : null}

      {records.map((rec) => (
        <TrainingCard key={rec.id} rec={rec} />
      ))}
      {pendingRecords.map((rec) => (
        <TrainingCard key={rec.id} rec={rec.payload as TrainingForm} badge={<PendingRequestBadge />} />
      ))}
      {draftRecords.map((rec) => (
        <TrainingCard key={rec.clientId} rec={rec.payload as TrainingForm} badge={<DraftBadge />} onRemove={() => onRemoveDraft(rec.clientId)} />
      ))}
    </div>
  )
}

export function ProfileUpdateRequestForm({
  schema,
  initialValues,
  pendingFields,
  collections,
}: ProfileUpdateRequestFormProps) {
  const router = useRouter()
  const [formValues, setFormValues] = useState<Record<string, string>>(() => initializeFormValues(initialValues))
  const [draftRecordCreates, setDraftRecordCreates] = useState<DraftRecord[]>([])
  const [queuedDocs, setQueuedDocs] = useState<QueuedDocument[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [docsRefreshToken, setDocsRefreshToken] = useState(0)

  const pendingSet = useMemo(() => new Set(pendingFields), [pendingFields])
  const fieldByKey = useMemo(() => buildFieldMap(schema), [schema])

  const handleFieldChange = (fieldKey: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [fieldKey]: value }))
  }

  const allSingleRecordKeys = useMemo(
    () => [
      ...PERSONAL_SECTIONS.flatMap((s) => [...s.fieldKeys]),
      ...CONTACT_SECTIONS.flatMap((s) => [...s.fieldKeys]),
      ...FINANCE_SECTIONS.flatMap((s) => [...s.fieldKeys]),
    ],
    []
  )

  const scalarDirtyCount = allSingleRecordKeys.reduce((acc, key) => {
    const field = fieldByKey.get(key)
    if (!field || !field.can_read || !field.can_write || pendingSet.has(key)) return acc
    return acc + ((formValues[key] ?? '') !== toStr(initialValues[key]) ? 1 : 0)
  }, 0)

  const draftCounts = useMemo(() => {
    return draftRecordCreates.reduce(
      (acc, draft) => {
        if (
          draft.table === 'employee_family' ||
          draft.table === 'employee_dependants' ||
          draft.table === 'employee_next_of_kin'
        ) {
          acc.relations += 1
        } else {
          acc.career += 1
        }
        return acc
      },
      { relations: 0, career: 0 }
    )
  }, [draftRecordCreates])

  const pendingCreatesByTable = useMemo(() => {
    const map = new Map<RecordCreateTable, PendingRecordCreate[]>()
    const tables: RecordCreateTable[] = [
      'employee_family',
      'employee_dependants',
      'employee_next_of_kin',
      'employee_experience',
      'employee_education',
      'employee_training',
    ]
    for (const table of tables) map.set(table, [])
    for (const row of collections.pendingRecordCreates) {
      const table = row.target_table as RecordCreateTable
      if (tables.includes(table)) map.get(table)?.push(row)
    }
    return map
  }, [collections.pendingRecordCreates])

  const addDraftRecord = (record: RecordCreateRequest) => {
    setDraftRecordCreates((prev) => [...prev, { ...record, clientId: crypto.randomUUID() }])
  }

  const removeDraftRecord = (clientId: string) => {
    setDraftRecordCreates((prev) => prev.filter((row) => row.clientId !== clientId))
  }

  const totalQueuedChanges = scalarDirtyCount + draftRecordCreates.length + queuedDocs.length

  const activeTabs = TABS.filter((tab) => {
    if (tab.id === 'personal') {
      return PERSONAL_SECTIONS.some((section) => section.fieldKeys.some((key) => fieldByKey.get(key)?.can_read))
    }
    if (tab.id === 'contact') {
      return CONTACT_SECTIONS.some((section) => section.fieldKeys.some((key) => fieldByKey.get(key)?.can_read))
    }
    if (tab.id === 'finance') {
      return FINANCE_SECTIONS.some((section) => section.fieldKeys.some((key) => fieldByKey.get(key)?.can_read))
    }
    return true
  })

  const handleSubmit = async () => {
    if (isSubmitting) return

    // Basic required-field validation for key identity/contact fields
    const REQUIRED_KEYS: string[] = [
      'employee_biodata.firstname',
      'employee_biodata.lastname',
      'employee_biodata.gender',
      'employees.email',
      'employees.phone',
    ]

    const missing: string[] = []
    for (const key of REQUIRED_KEYS) {
      const field = fieldByKey.get(key)
      if (!field || !field.can_read) continue
      const value = (formValues[key] ?? '').trim()
      if (!value) missing.push(field.label)
    }

    if (missing.length > 0) {
      toast.error(`Please fill in required fields: ${missing.join(', ')}`)
      return
    }

    const changes: Record<string, unknown> = {}
    for (const fields of Object.values(schema)) {
      for (const field of fields) {
        if (!field.can_read || !field.can_write) continue
        if (pendingSet.has(field.field_key)) continue
        const current = formValues[field.field_key] ?? ''
        const original = toStr(initialValues[field.field_key])
        if (current !== original) changes[field.field_key] = current === '' ? null : current
      }
    }

    if (Object.keys(changes).length === 0 && draftRecordCreates.length === 0 && queuedDocs.length === 0) {
      toast.info('No changes to submit.')
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('changes', JSON.stringify(changes))
      formData.append(
        'recordCreates',
        JSON.stringify(draftRecordCreates.map(({ table, payload }) => ({ table, payload }))),
      )
      formData.append(
        'documentMeta',
        JSON.stringify(
          queuedDocs.map((d) => ({
            clientId: d.clientId,
            documentTypeId: d.documentTypeId,
            title: d.title,
            issueDate: d.issueDate,
            expiryDate: d.expiryDate,
          })),
        ),
      )
      for (const doc of queuedDocs) {
        formData.append(`doc_${doc.clientId}`, doc.file)
      }

      const res = await fetch('/api/profile-update-request', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      })

      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }

      if (!res.ok || !json.success) {
        toast.error(json.error ?? 'Submission failed. Please try again.')
        return
      }

      setDraftRecordCreates([])
      setQueuedDocs([])
      setDocsRefreshToken((t) => t + 1)
      toast.success('Your profile update request has been submitted. HR will review your changes.')
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'An unexpected error occurred.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue={activeTabs[0]?.id ?? 'personal'}>
        <div className="overflow-x-auto border-b">
          <TabsList className="flex h-auto w-max min-w-full gap-0 rounded-none bg-transparent p-0">
            {activeTabs.map(({ id, label, Icon }) => {
              const scalarKeys =
                id === 'personal'
                  ? PERSONAL_SECTIONS.flatMap((s) => [...s.fieldKeys])
                  : id === 'contact'
                  ? CONTACT_SECTIONS.flatMap((s) => [...s.fieldKeys])
                  : id === 'finance'
                  ? FINANCE_SECTIONS.flatMap((s) => [...s.fieldKeys])
                  : []

              const scalarCount = scalarKeys.reduce((acc, key) => {
                const field = fieldByKey.get(key)
                if (!field || !field.can_read || !field.can_write || pendingSet.has(key)) return acc
                return acc + ((formValues[key] ?? '') !== toStr(initialValues[key]) ? 1 : 0)
              }, 0)

              const tabCount =
                id === 'relations'
                  ? draftCounts.relations
                  : id === 'career'
                    ? draftCounts.career
                    : id === 'documents'
                      ? queuedDocs.length
                      : scalarCount

              return (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="relative shrink-0 gap-1.5 rounded-none border-b-2 border-transparent px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  <Icon className="size-3.5" />
                  {label}
                  {tabCount > 0 ? (
                    <span className="ml-1 inline-flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
                      {tabCount}
                    </span>
                  ) : null}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>

        <TabsContent value="personal" className="mt-4">
          <div className="space-y-5">
            {PERSONAL_SECTIONS.map((section) => (
              <ScalarSectionCard
                key={section.id}
                title={section.title}
                fieldKeys={section.fieldKeys}
                fieldByKey={fieldByKey}
                formValues={formValues}
                initialValues={initialValues}
                pendingSet={pendingSet}
                onChange={handleFieldChange}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="contact" className="mt-4">
          <div className="space-y-5">
            {CONTACT_SECTIONS.map((section) => (
              <ScalarSectionCard
                key={section.id}
                title={section.title}
                fieldKeys={section.fieldKeys}
                fieldByKey={fieldByKey}
                formValues={formValues}
                initialValues={initialValues}
                pendingSet={pendingSet}
                onChange={handleFieldChange}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="finance" className="mt-4">
          <div className="space-y-5">
            {FINANCE_SECTIONS.map((section) => (
              <ScalarSectionCard
                key={section.id}
                title={section.title}
                fieldKeys={section.fieldKeys}
                fieldByKey={fieldByKey}
                formValues={formValues}
                initialValues={initialValues}
                pendingSet={pendingSet}
                onChange={handleFieldChange}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <EssDocumentsTab
            employeeId={collections.employeeId}
            queuedDocs={queuedDocs}
            onQueued={(doc) => setQueuedDocs((prev) => [doc, ...prev])}
            onRemoveQueued={(clientId) =>
              setQueuedDocs((prev) => prev.filter((d) => d.clientId !== clientId))
            }
            refreshToken={docsRefreshToken}
          />
        </TabsContent>

        <TabsContent value="relations" className="mt-4">
          <div className="space-y-5">
            <PersonCreateSection
              title="Family records"
              table="employee_family"
              records={collections.family}
              pendingRecords={pendingCreatesByTable.get('employee_family') ?? []}
              draftRecords={draftRecordCreates.filter((row) => row.table === 'employee_family')}
              onAddDraft={addDraftRecord}
              onRemoveDraft={removeDraftRecord}
            />
            <NextOfKinCreateSection
              records={collections.nextOfKin}
              pendingRecords={pendingCreatesByTable.get('employee_next_of_kin') ?? []}
              draftRecords={draftRecordCreates.filter((row) => row.table === 'employee_next_of_kin')}
              onAddDraft={addDraftRecord}
              onRemoveDraft={removeDraftRecord}
            />
            <PersonCreateSection
              title="Dependant records"
              table="employee_dependants"
              records={collections.dependants}
              pendingRecords={pendingCreatesByTable.get('employee_dependants') ?? []}
              draftRecords={draftRecordCreates.filter((row) => row.table === 'employee_dependants')}
              onAddDraft={addDraftRecord}
              onRemoveDraft={removeDraftRecord}
            />
          </div>
        </TabsContent>

        <TabsContent value="career" className="mt-4">
          <div className="space-y-5">
            <ExperienceCreateSection
              records={collections.experience}
              pendingRecords={pendingCreatesByTable.get('employee_experience') ?? []}
              draftRecords={draftRecordCreates.filter((row) => row.table === 'employee_experience')}
              onAddDraft={addDraftRecord}
              onRemoveDraft={removeDraftRecord}
            />
            <EducationCreateSection
              records={collections.education}
              pendingRecords={pendingCreatesByTable.get('employee_education') ?? []}
              draftRecords={draftRecordCreates.filter((row) => row.table === 'employee_education')}
              onAddDraft={addDraftRecord}
              onRemoveDraft={removeDraftRecord}
            />
            <TrainingCreateSection
              records={collections.training}
              pendingRecords={pendingCreatesByTable.get('employee_training') ?? []}
              draftRecords={draftRecordCreates.filter((row) => row.table === 'employee_training')}
              onAddDraft={addDraftRecord}
              onRemoveDraft={removeDraftRecord}
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {totalQueuedChanges > 0 ? (
            <>
              <span className="font-semibold text-foreground">{totalQueuedChanges}</span>{' '}
              {totalQueuedChanges === 1 ? 'change' : 'changes'} queued — HR must approve before they take effect.
            </>
          ) : (
            'Edit fields above, add any new records you need, then submit for HR review.'
          )}
        </p>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || totalQueuedChanges === 0}
          size="sm"
          className="shrink-0"
        >
          {isSubmitting ? <Loader2Icon className="mr-2 size-3.5 animate-spin" /> : null}
          Submit Request
        </Button>
      </div>
    </div>
  )
}