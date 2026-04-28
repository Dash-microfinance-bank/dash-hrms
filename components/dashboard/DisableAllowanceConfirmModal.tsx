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
import { disableAllowance } from '@/lib/actions/salary-components'
import { toast } from 'sonner'

type DisableAllowanceConfirmModalProps = {
  allowance: SalaryComponentRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DisableAllowanceConfirmModal({
  allowance,
  open,
  onOpenChange,
  onSuccess,
}: DisableAllowanceConfirmModalProps) {
  const [isDisabling, setIsDisabling] = React.useState(false)

  const handleDisable = async () => {
    if (!allowance) return
    setIsDisabling(true)
    const result = await disableAllowance(allowance.id)
    setIsDisabling(false)

    if (result.success) {
      toast.success('Allowance disabled')
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
          <AlertDialogTitle>Disable allowance</AlertDialogTitle>
          <AlertDialogDescription>
            Disable {allowance?.name ?? 'this allowance'}? It will remain in history but become
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
