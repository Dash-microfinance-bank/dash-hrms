'use client'

import React, { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckIcon, PlusIcon, RefreshCwIcon, UserIcon, XIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  useAvatarUpload,
  validateAvatarFile,
} from '@/lib/hooks/use-avatar-upload'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type EmployeeAvatarPickerProps = {
  /** The last persisted URL from the database. Used as the fallback display. */
  avatarUrl?: string | null
  initials: string
  employeeName?: string
  employeeId: string
  /**
   * Called with the new canonical public URL once the server confirms the upload.
   * The parent can use this to patch its local state without waiting for a refetch.
   */
  onAvatarCommitted?: (avatarUrl: string) => void
  /**
   * When true (e.g. parent is fetching employee data), show a neutral user icon
   * instead of initials and hide the upload (+) control until data is ready.
   */
  isAwaitingEmployeeData?: boolean
}

// ─── Progress ring ────────────────────────────────────────────────────────────

function ProgressRing({ progress }: { progress: number }) {
  const radius = 20
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - progress / 100)

  return (
    <svg
      className="absolute inset-0 size-11 -rotate-90 pointer-events-none"
      viewBox="0 0 44 44"
      aria-hidden
    >
      {/* Track */}
      <circle
        cx="22" cy="22" r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="text-muted/40"
      />
      {/* Fill */}
      <circle
        cx="22" cy="22" r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-primary transition-[stroke-dashoffset] duration-200 ease-linear"
      />
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EmployeeAvatarPicker({
  avatarUrl: savedAvatarUrl,
  initials,
  employeeName,
  employeeId,
  onAvatarCommitted,
  isAwaitingEmployeeData = false,
}: EmployeeAvatarPickerProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const router = useRouter()
  const [, startTransition] = useTransition()

  const { upload, progress, isUploading, isError, reset } =
    useAvatarUpload({
      employeeId,
      onCommitted: (url) => {
        // Server has persisted the new URL — clear the pending local selection
        // so the component displays the confirmed server URL going forward.
        setSelectedFile(null)
        if (inputRef.current) inputRef.current.value = ''
        onAvatarCommitted?.(url)
        // API route already calls revalidatePath for /dashboard/admin/employees.
        // Refresh the current RSC tree so server components (e.g. EmployeesTableWithData)
        // refetch without a full navigation.
        startTransition(() => {
          router.refresh()
        })
      },
    })

  // Blob preview URL — created synchronously so the image swaps instantly.
  const previewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : null),
    [selectedFile],
  )

  // Revoke the blob URL when it changes or the component unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // Optimistic: show blob preview while upload is in-flight or pending confirm.
  // Fall back to the server-persisted URL, then nothing (renders initials).
  const displayUrl = previewUrl ?? savedAvatarUrl ?? null

  // ── Event handlers ──────────────────────────────────────────────────────────

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (!file) return
    const validationError = validateAvatarFile(file)
    if (validationError) {
      toast.error(validationError)
      event.target.value = ''
      return
    }
    // Swap optimistic preview immediately; do not upload until the user confirms.
    setSelectedFile(file)
    reset()
  }

  const handleCancel = () => {
    setSelectedFile(null)
    if (inputRef.current) inputRef.current.value = ''
    reset()
  }

  const handleConfirm = () => {
    if (!selectedFile || isUploading) return
    upload(selectedFile)
  }

  const handleRetry = () => {
    if (!selectedFile || isUploading) return
    upload(selectedFile)
  }

  // ── Derived visibility flags ────────────────────────────────────────────────
  const hasPendingFile = !!selectedFile
  const showPlusButton =
    !hasPendingFile && !isUploading && !isAwaitingEmployeeData
  const showActionButtons = hasPendingFile || isError

  return (
    <div className="relative">
      {/* Avatar image */}
      <Avatar className="size-11 shrink-0">
        {displayUrl ? (
          <AvatarImage
            src={displayUrl}
            alt={employeeName ?? 'Employee avatar'}
            className="object-cover rounded-full"
          />
        ) : null}
        <AvatarFallback className="text-sm font-semibold bg-muted">
          {isAwaitingEmployeeData ? (
            <UserIcon className="size-5 text-muted-foreground" aria-hidden />
          ) : (
            initials
          )}
        </AvatarFallback>
      </Avatar>

      {/* Upload progress ring — visible only while uploading */}
      {isUploading ? <ProgressRing progress={progress} /> : null}

      {/* Plus button — hidden while a file is staged or upload is in-flight */}
      {showPlusButton ? (
        <label
          htmlFor={inputId}
          className="absolute bottom-0 right-0 size-4 bg-primary rounded-full flex justify-center items-center cursor-pointer"
        >
          <PlusIcon className="size-3 text-white" />
        </label>
      ) : null}

      {/* Hidden file input */}
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Cancel / Confirm / Retry buttons */}
      {showActionButtons ? (
        <div>
          {/* Cancel — always shown when a file is staged */}
          <button
            type="button"
            disabled={isUploading}
            aria-label="Cancel avatar change"
            className={`absolute -bottom-2 -left-1 size-5 bg-red-500 rounded-full flex justify-center items-center disabled:opacity-40 ${isUploading ? 'hidden' : ''}`}
            onClick={handleCancel}
          >
            <XIcon className="size-3 text-white" />
          </button>

          {/* Confirm (idle / success) or Retry (error) */}
          {isError ? (
            <button
              type="button"
              aria-label="Retry avatar upload"
              className={`absolute -bottom-2 -right-1 size-5 bg-amber-500 rounded-full flex justify-center items-center ${isUploading ? 'hidden' : ''}`}
              onClick={handleRetry}
            >
              <RefreshCwIcon className="size-3 text-white" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isUploading}
              aria-label="Confirm avatar upload"
              className={`absolute -bottom-2 -right-1 size-5 bg-green-500 rounded-full flex justify-center items-center disabled:opacity-40 ${isUploading ? 'hidden' : ''}`}
              onClick={handleConfirm}
            >
              <CheckIcon className="size-3 text-white" />
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}
