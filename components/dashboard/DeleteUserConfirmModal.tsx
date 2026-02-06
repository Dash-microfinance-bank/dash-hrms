'use client'

import React, { useState } from 'react'
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
import { deleteUser } from '@/lib/actions/users'
import type { ProfileRow } from '@/lib/data/users'
import { toast } from 'sonner'

type DeleteUserConfirmModalProps = {
  user: ProfileRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DeleteUserConfirmModal({
  user,
  open,
  onOpenChange,
  onSuccess,
}: DeleteUserConfirmModalProps) {
  const [deleting, setDeleting] = useState(false)

  const handleConfirm = async () => {
    if (!user) return
    setDeleting(true)
    const result = await deleteUser(user.id)
    setDeleting(false)
    if (result.success) {
      toast.success('User removed')
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
          <AlertDialogTitle>Remove user</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove{' '}
            <strong>{user?.full_name ?? 'this user'}</strong>? This will delete
            their profile, access, and account. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? 'Removing…' : 'Remove user'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
