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
import type { GradeRow } from '@/lib/data/grades'
import { deleteGrade } from '@/lib/actions/grades'
import { toast } from 'sonner'

type DeleteGradeConfirmModalProps = {
  grade: GradeRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DeleteGradeConfirmModal({
  grade,
  open,
  onOpenChange,
  onSuccess,
}: DeleteGradeConfirmModalProps) {
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleDelete = async () => {
    if (!grade) return
    setIsDeleting(true)
    const result = await deleteGrade(grade.id)
    setIsDeleting(false)

    if (result.success) {
      toast.success('Grade deleted')
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  const displayName =
    grade?.code && grade.code.trim().length > 0
      ? `${grade.name} (${grade.code.trim()})`
      : grade?.name ?? 'this grade'

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete grade</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {displayName}? This action cannot be undone.
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

