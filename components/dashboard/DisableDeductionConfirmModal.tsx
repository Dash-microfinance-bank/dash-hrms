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
import { disableDeduction } from '@/lib/actions/deductions'
import { toast } from 'sonner'

type DisableDeductionConfirmModalProps = {
  deduction: DeductionTableRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DisableDeductionConfirmModal({
  deduction,
  open,
  onOpenChange,
  onSuccess,
}: DisableDeductionConfirmModalProps) {
  const [isDisabling, setIsDisabling] = React.useState(false)

  const handleDisable = async () => {
    if (!deduction) return
    setIsDisabling(true)
    const result = await disableDeduction(deduction.id)
    setIsDisabling(false)

    if (result.success) {
      toast.success('Deduction disabled')
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
          <AlertDialogTitle>Disable deduction</AlertDialogTitle>
          <AlertDialogDescription>
            Disable {deduction?.name ?? 'this deduction'}? It will remain in history but become
            inactive.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDisabling}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={handleDisable} disabled={isDisabling}>
              {isDisabling ? 'Disabling…' : 'Disable'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
