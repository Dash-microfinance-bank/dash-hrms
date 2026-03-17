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
import type { DocumentCategoryRow } from '@/lib/data/document-categories'
import { updateDocumentCategory } from '@/lib/actions/document-categories'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(120, 'Name is too long').trim(),
})

type FormValues = z.infer<typeof schema>

type EditDocumentCategoryModalProps = {
  category: DocumentCategoryRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditDocumentCategoryModal({
  category,
  open,
  onOpenChange,
  onSuccess,
}: EditDocumentCategoryModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: category ? { name: category.name } : { name: '' },
  })

  const onSubmit = async (values: FormValues) => {
    if (!category) return
    const result = await updateDocumentCategory(category.id, values.name)
    if (result.success) {
      toast.success('Document category updated')
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
          <DialogTitle>Edit document category</DialogTitle>
          <DialogDescription>
            Change the category name. It must remain unique within your organization and cannot match a system default category (e.g. Identity, Education, Employment).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="edit-category-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="edit-category-name"
              {...register('name')}
              placeholder="e.g. Identity Documents"
              className={errors.name ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'}
            />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            ) : null}
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
