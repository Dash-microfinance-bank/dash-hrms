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
import type { EarningStructureSummaryRow } from '@/lib/data/earning-structure-summary'
import { deleteEarningStructureSummary } from '@/lib/actions/earning-structure-summary'
import { toast } from 'sonner'

type Props = {
  row: EarningStructureSummaryRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DeleteEarningStructureSummaryConfirmModal({
  row,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleDelete = async () => {
    if (!row) return
    setIsSubmitting(true)
    const result = await deleteEarningStructureSummary(row.mapping_id)
    setIsSubmitting(false)
    if (result.success) {
      toast.success('Structure deleted')
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
          <AlertDialogTitle>Delete structure</AlertDialogTitle>
          <AlertDialogDescription>
            Delete structure {row?.structure_name ?? 'this structure'}? This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting ? 'Deleting…' : 'Delete'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
