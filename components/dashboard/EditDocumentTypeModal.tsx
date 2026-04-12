'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DocumentTypeRow } from '@/lib/data/document-types'
import type { DocumentCategoryRow } from '@/lib/data/document-categories'
import { updateDocumentType } from '@/lib/actions/document-types'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(120, 'Name is too long').trim(),
  document_category_id: z.string().min(1, 'Category is required'),
  is_required: z.boolean(),
  approval_required: z.boolean(),
  allow_multiple: z.boolean(),
})

type FormValues = z.infer<typeof schema>

type EditDocumentTypeModalProps = {
  documentType: DocumentTypeRow | null
  categories: DocumentCategoryRow[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditDocumentTypeModal({
  documentType,
  categories,
  open,
  onOpenChange,
  onSuccess,
}: EditDocumentTypeModalProps) {
  const isOrganizationLevel = documentType?.owner_type === 'ORGANIZATION'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: documentType
      ? {
          name: documentType.name,
          document_category_id: documentType.document_category_id ?? '',
          is_required: documentType.is_required,
          approval_required: documentType.approval_required,
          allow_multiple: documentType.allow_multiple ?? false,
        }
      : {
          name: '',
          document_category_id: '',
          is_required: false,
          approval_required: false,
          allow_multiple: false,
        },
  })

  const onSubmit = async (values: FormValues) => {
    if (!documentType) return
    const isOrganizationLevel = documentType.owner_type === 'ORGANIZATION'

    const result = await updateDocumentType(documentType.id, {
      name: values.name,
      document_category_id: values.document_category_id,
      is_required: isOrganizationLevel ? documentType.is_required : values.is_required,
      approval_required: isOrganizationLevel
        ? documentType.approval_required
        : values.approval_required,
      allow_multiple: values.allow_multiple,
    })
    if (result.success) {
      toast.success('Document type updated')
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit document type</DialogTitle>
          <DialogDescription>
            Update the document type. Names must remain unique within your organization.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-doctype-name">Name</Label>
            <Input
              id="edit-doctype-name"
              {...register('name')}
              placeholder="e.g. National ID"
              className={errors.name ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'}
            />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-doctype-category">Category</Label>
            <select
              id="edit-doctype-category"
              {...register('document_category_id')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.organization_id == null || c.system_default ? ' (System)' : ''}
                </option>
              ))}
            </select>
            {errors.document_category_id ? (
              <p className="text-xs text-destructive">{errors.document_category_id.message}</p>
            ) : null}
          </div>
          {isOrganizationLevel && (
            <div className="space-y-2">
              <Label htmlFor="edit-doctype-owner-type">Applies to</Label>
              <select
                id="edit-doctype-owner-type"
                disabled
                className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm shadow-sm opacity-75"
                value={documentType?.owner_type ?? ''}
              >
                <option value="USER">Employee</option>
                <option value="ORGANIZATION">Company</option>
                <option value="DEPARTMENT">Department</option>
              </select>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {!isOrganizationLevel && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-doctype-required"
                    {...register('is_required')}
                    className="size-4 rounded border-input"
                  />
                  <Label htmlFor="edit-doctype-required" className="font-normal cursor-pointer">
                    Required
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-doctype-approval"
                    {...register('approval_required')}
                    className="size-4 rounded border-input"
                  />
                  <Label htmlFor="edit-doctype-approval" className="font-normal cursor-pointer">
                    Approval required
                  </Label>
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-doctype-allow-multiple"
                {...register('allow_multiple')}
                className="size-4 rounded border-input"
              />
              <Label htmlFor="edit-doctype-allow-multiple" className="font-normal cursor-pointer">
                Allow multiple uploads
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
