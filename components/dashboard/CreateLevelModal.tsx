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
import { createEmployeeLevel } from '@/lib/actions/employee-levels'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(120, 'Name is too long').trim(),
})

type FormValues = z.infer<typeof schema>

type CreateLevelModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateLevelModal({ open, onOpenChange, onSuccess }: CreateLevelModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  })

  const onSubmit = async (values: FormValues) => {
    const result = await createEmployeeLevel({ name: values.name })
    if (result.success) {
      toast.success('Level created')
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
          <DialogTitle>Create level</DialogTitle>
          <DialogDescription>Add a new employee level for your organization.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="create-level-name" className="ml-2 text-sm font-medium">
              Name
            </label>
            <Input
              id="create-level-name"
              placeholder="e.g. Level 1"
              {...register('name')}
              className={
                errors.name
                  ? 'border-destructive outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
                  : 'outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
              }
            />
            {errors.name ? (
              <p className="ml-2 text-xs text-destructive">{errors.name.message}</p>
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
              {isSubmitting ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
