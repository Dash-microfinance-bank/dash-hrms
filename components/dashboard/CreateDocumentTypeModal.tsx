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
import { createDocumentType } from '@/lib/actions/document-types'
import type { DocumentCategoryRow } from '@/lib/data/document-categories'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(120, 'Name is too long').trim(),
  document_category_id: z.string().min(1, 'Category is required'),
  owner_type: z.enum(['USER', 'ORGANIZATION']),
  is_required: z.boolean(),
  approval_required: z.boolean(),
  allow_multiple: z.boolean(),
})

type FormValues = z.infer<typeof schema>

type CreateDocumentTypeModalProps = {
  categories: DocumentCategoryRow[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateDocumentTypeModal({
  categories,
  open,
  onOpenChange,
  onSuccess,
}: CreateDocumentTypeModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      document_category_id: '',
      owner_type: 'USER',
      is_required: false,
      approval_required: false,
      allow_multiple: false,
    },
  })

  const ownerType = watch('owner_type')

  const onSubmit = async (values: FormValues) => {
    const isOrganizationLevel = values.owner_type === 'ORGANIZATION'

    const result = await createDocumentType({
      name: values.name,
      document_category_id: values.document_category_id,
      owner_type: values.owner_type,
      is_required: isOrganizationLevel ? false : values.is_required,
      approval_required: isOrganizationLevel ? false : values.approval_required,
      allow_multiple: values.allow_multiple,
    })
    if (result.success) {
      toast.success('Document type created')
      reset()
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
          <DialogTitle>Create document type</DialogTitle>
          <DialogDescription>
            Add a new document type for your organization. Names must be unique within your organization. Select a category and set whether it is required or needs approval.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-doctype-name">Name</Label>
            <Input
              id="create-doctype-name"
              {...register('name')}
              placeholder="e.g. National ID"
              className={errors.name ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'}
            />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-doctype-category">Category</Label>
            <select
              id="create-doctype-category"
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
          <div className="space-y-2">
            <Label htmlFor="create-doctype-owner-type">Applies to</Label>
            <select
              id="create-doctype-owner-type"
              {...register('owner_type')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
            >
              <option value="USER">Employee</option>
              <option value="ORGANIZATION">Company</option>
            </select>
          </div>
          <div className="flex flex-col gap-3">
            {ownerType !== 'ORGANIZATION' && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="create-doctype-required"
                    {...register('is_required')}
                    className="size-4 rounded border-input"
                  />
                  <Label htmlFor="create-doctype-required" className="font-normal cursor-pointer">
                    Required
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="create-doctype-approval"
                    {...register('approval_required')}
                    className="size-4 rounded border-input"
                  />
                  <Label
                    htmlFor="create-doctype-approval"
                    className="font-normal cursor-pointer"
                  >
                    Approval required
                  </Label>
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="create-doctype-allow-multiple"
                {...register('allow_multiple')}
                className="size-4 rounded border-input"
              />
              <Label
                htmlFor="create-doctype-allow-multiple"
                className="font-normal cursor-pointer"
              >
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
              {isSubmitting ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
