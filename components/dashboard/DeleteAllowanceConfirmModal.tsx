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
import type { SalaryComponentRow } from '@/lib/data/salary-components'
import { deleteAllowance } from '@/lib/actions/salary-components'
import { toast } from 'sonner'

type DeleteAllowanceConfirmModalProps = {
  allowance: SalaryComponentRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DeleteAllowanceConfirmModal({
  allowance,
  open,
  onOpenChange,
  onSuccess,
}: DeleteAllowanceConfirmModalProps) {
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleDelete = async () => {
    if (!allowance) return
    setIsDeleting(true)
    const result = await deleteAllowance(allowance.id)
    setIsDeleting(false)

    if (result.success) {
      toast.success('Allowance deleted')
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
          <AlertDialogTitle>Delete allowance</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {allowance?.name ?? 'this allowance'}? This action
            cannot be undone.
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
