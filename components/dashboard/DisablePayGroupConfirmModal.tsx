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
import { disablePayGroup } from '@/lib/actions/pay-groups'

type DisablePayGroupConfirmModalProps = {
  payGroup: PayGroupRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DisablePayGroupConfirmModal({
  payGroup,
  open,
  onOpenChange,
  onSuccess,
}: DisablePayGroupConfirmModalProps) {
  const [isDisabling, setIsDisabling] = React.useState(false)

  const handleDisable = async () => {
    if (!payGroup) return
    setIsDisabling(true)
    const result = await disablePayGroup(payGroup.id)
    setIsDisabling(false)
    if (result.success) {
      toast.success('Pay group disabled')
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
          <AlertDialogTitle>Disable pay group</AlertDialogTitle>
          <AlertDialogDescription>
            Disable {payGroup?.name ?? 'this pay group'}? It will remain in history but become
            unavailable for active payroll setup.
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
