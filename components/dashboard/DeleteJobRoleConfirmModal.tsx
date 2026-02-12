'use client'

import React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { JobRoleRow } from '@/lib/data/job-roles'
import { deleteJobRole } from '@/lib/actions/job-roles'
import { toast } from 'sonner'

type DeleteJobRoleConfirmModalProps = {
  jobRole: JobRoleRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DeleteJobRoleConfirmModal({
  jobRole,
  open,
  onOpenChange,
  onSuccess,
}: DeleteJobRoleConfirmModalProps) {
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleDelete = async () => {
    if (!jobRole) return
    setIsDeleting(true)
    const result = await deleteJobRole(jobRole.id)
    setIsDeleting(false)

    if (result.success) {
      toast.success('Job role deleted')
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  const displayTitle =
    jobRole?.code && jobRole.code.trim().length > 0
      ? `${jobRole.name} (${jobRole.code.trim()})`
      : jobRole?.name ?? 'this job role'

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete job role</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {displayTitle}? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

