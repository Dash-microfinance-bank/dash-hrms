'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { disableStructureAllowanceAssignment } from '@/lib/actions/earning-structure-components'
import type { EarningStructureAllowanceRow } from '@/lib/data/earning-structure-detail'

type DisableStructureAllowanceConfirmModalProps = {
  row: EarningStructureAllowanceRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DisableStructureAllowanceConfirmModal({
  row,
  open,
  onOpenChange,
  onSuccess,
}: DisableStructureAllowanceConfirmModalProps) {
  const [isDisabling, setIsDisabling] = useState(false)

  const handleDisable = async () => {
    if (!row) return
    setIsDisabling(true)

    const result = await disableStructureAllowanceAssignment(row.assignment_id)
    setIsDisabling(false)

    if (result.success) {
      toast.success('Allowance assignment disabled')
      onSuccess()
      onOpenChange(false)
      return
    }

    toast.error(result.error)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Disable allowance assignment</DialogTitle>
          <DialogDescription>
            {row
              ? `This sets ${row.allowance_name} value to 0 for this structure.`
              : 'This sets this allowance value to 0 for this structure.'}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDisabling}>
            Cancel
          </Button>
          <Button onClick={handleDisable} disabled={isDisabling}>
            {isDisabling ? 'Disabling…' : 'Disable'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
