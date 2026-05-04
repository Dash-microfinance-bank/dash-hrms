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
import { disableEarningStructureSummary } from '@/lib/actions/earning-structure-summary'
import { toast } from 'sonner'

type Props = {
  row: EarningStructureSummaryRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DisableEarningStructureSummaryConfirmModal({
  row,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleDisable = async () => {
    if (!row) return
    setIsSubmitting(true)
    const result = await disableEarningStructureSummary(row.mapping_id)
    setIsSubmitting(false)
    if (result.success) {
      toast.success('Structure disabled')
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
          <AlertDialogTitle>Disable structure</AlertDialogTitle>
          <AlertDialogDescription>
            Disable structure {row?.structure_name ?? 'this structure'}? This will disable all
            allowances under it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={handleDisable} disabled={isSubmitting}>
              {isSubmitting ? 'Disabling…' : 'Disable'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
