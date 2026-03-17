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
import type { DocumentTypeRow } from '@/lib/data/document-types'
import { deleteDocumentType } from '@/lib/actions/document-types'
import { toast } from 'sonner'

type DeleteDocumentTypeConfirmModalProps = {
  documentType: DocumentTypeRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DeleteDocumentTypeConfirmModal({
  documentType,
  open,
  onOpenChange,
  onSuccess,
}: DeleteDocumentTypeConfirmModalProps) {
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleDelete = async () => {
    if (!documentType) return
    setIsDeleting(true)
    const result = await deleteDocumentType(documentType.id)
    setIsDeleting(false)
    if (result.success) {
      toast.success('Document type deleted')
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  const displayName = documentType?.name ?? 'this document type'

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete document type</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {displayName}? This action cannot be undone.
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
