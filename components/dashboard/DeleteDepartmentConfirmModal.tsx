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
import type { DepartmentRow } from '@/lib/data/departments'
import { deleteDepartment } from '@/lib/actions/departments'
import { toast } from 'sonner'

type DeleteDepartmentConfirmModalProps = {
  department: DepartmentRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DeleteDepartmentConfirmModal({
  department,
  open,
  onOpenChange,
  onSuccess,
}: DeleteDepartmentConfirmModalProps) {
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleDelete = async () => {
    if (!department) return
    setIsDeleting(true)
    const result = await deleteDepartment(department.id)
    setIsDeleting(false)

    if (result.success) {
      toast.success('Department deleted')
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  const displayName = department?.code
    ? `${department.name} (${department.code})`
    : department?.name ?? 'this department'

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete department</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {displayName}? This action cannot be undone.
            Any job roles that depend on this department may prevent deletion.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            asChild
          >
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

