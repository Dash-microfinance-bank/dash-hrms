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
import { toast } from 'sonner'
import type { PayGroupRow } from '@/lib/data/pay-groups'
import { deletePayGroup } from '@/lib/actions/pay-groups'

type DeletePayGroupConfirmModalProps = {
  payGroup: PayGroupRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DeletePayGroupConfirmModal({
  payGroup,
  open,
  onOpenChange,
  onSuccess,
}: DeletePayGroupConfirmModalProps) {
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleDelete = async () => {
    if (!payGroup) return
    setIsDeleting(true)
    const result = await deletePayGroup(payGroup.id)
    setIsDeleting(false)
    if (result.success) {
      toast.success('Pay group deleted')
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
          <AlertDialogTitle>Delete pay group</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {payGroup?.name ?? 'this pay group'}? Linked employees
            will be unassigned from this group.
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
