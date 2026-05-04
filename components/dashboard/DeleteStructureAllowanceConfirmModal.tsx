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
import { deleteStructureAllowanceAssignment } from '@/lib/actions/earning-structure-components'
import type { EarningStructureAllowanceRow } from '@/lib/data/earning-structure-detail'

type DeleteStructureAllowanceConfirmModalProps = {
  row: EarningStructureAllowanceRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DeleteStructureAllowanceConfirmModal({
  row,
  open,
  onOpenChange,
  onSuccess,
}: DeleteStructureAllowanceConfirmModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!row) return
    setIsDeleting(true)

    const result = await deleteStructureAllowanceAssignment(row.assignment_id)
    setIsDeleting(false)

    if (result.success) {
      toast.success('Allowance assignment deleted')
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
          <DialogTitle>Delete allowance assignment</DialogTitle>
          <DialogDescription>
            {row
              ? `This will remove ${row.allowance_name} from this earning structure.`
              : 'This will remove this allowance from this earning structure.'}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
