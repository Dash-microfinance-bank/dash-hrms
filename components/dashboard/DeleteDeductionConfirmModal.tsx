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
import type { DeductionTableRow } from '@/lib/data/deductions'
import { deleteDeduction } from '@/lib/actions/deductions'
import { toast } from 'sonner'

type DeleteDeductionConfirmModalProps = {
  deduction: DeductionTableRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DeleteDeductionConfirmModal({
  deduction,
  open,
  onOpenChange,
  onSuccess,
}: DeleteDeductionConfirmModalProps) {
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleDelete = async () => {
    if (!deduction) return
    setIsDeleting(true)
    const result = await deleteDeduction(deduction.id)
    setIsDeleting(false)

    if (result.success) {
      toast.success('Deduction deleted')
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
          <AlertDialogTitle>Delete deduction</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {deduction?.name ?? 'this deduction'}? This action cannot
            be undone.
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
