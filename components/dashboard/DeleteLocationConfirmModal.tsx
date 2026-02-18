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
import type { LocationRow } from '@/lib/data/locations'
import { deleteLocation } from '@/lib/actions/locations'
import { toast } from 'sonner'

type DeleteLocationConfirmModalProps = {
  location: LocationRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DeleteLocationConfirmModal({
  location,
  open,
  onOpenChange,
  onSuccess,
}: DeleteLocationConfirmModalProps) {
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleDelete = async () => {
    if (!location) return
    setIsDeleting(true)
    const result = await deleteLocation(location.id)
    setIsDeleting(false)

    if (result.success) {
      toast.success('Location removed')
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  const displayText = location
    ? [location.country, location.state, location.address]
        .filter(Boolean)
        .join(', ') || 'this location'
    : 'this location'

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove location</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove {displayText}? This action cannot be undone.
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
              {isDeleting ? 'Removing…' : 'Remove location'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
