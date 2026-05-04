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
import type { EmployeeLevelRow } from '@/lib/data/employee-levels'
import { deleteEmployeeLevel } from '@/lib/actions/employee-levels'
import { toast } from 'sonner'

type DeleteLevelConfirmModalProps = {
  level: EmployeeLevelRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DeleteLevelConfirmModal({
  level,
  open,
  onOpenChange,
  onSuccess,
}: DeleteLevelConfirmModalProps) {
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleDelete = async () => {
    if (!level) return
    setIsDeleting(true)
    const result = await deleteEmployeeLevel(level.id)
    setIsDeleting(false)

    if (result.success) {
      toast.success('Level deleted')
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete level</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {level?.name ?? 'this level'}? This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
