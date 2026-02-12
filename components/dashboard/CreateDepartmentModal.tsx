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
import { createDepartment } from '@/lib/actions/departments'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120, 'Name is too long').trim(),
  code: z
    .string()
    .max(20, 'Code is too long')
    .trim()
    .optional()
    .or(z.literal('')),
  description: z
    .string()
    .max(500, 'Description is too long')
    .trim()
    .optional()
    .or(z.literal('')),
})

type CreateDepartmentFormValues = z.infer<typeof createDepartmentSchema>

type CreateDepartmentModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function CreateDepartmentFormBody({
  onOpenChange,
  onSuccess,
}: Pick<CreateDepartmentModalProps, 'onOpenChange' | 'onSuccess'>) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateDepartmentFormValues>({
    resolver: zodResolver(createDepartmentSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
    },
  })

  const onSubmit = async (values: CreateDepartmentFormValues) => {
    const result = await createDepartment({
      name: values.name,
      code: values.code || null,
      description: values.description || null,
    })

    if (result.success) {
      toast.success('Department created')
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create department</DialogTitle>
        <DialogDescription>
          Create a new department for this organization. Names are unique within your organization.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="dept-name" className="text-sm font-medium ml-2">
            Name
          </label>
          <Input
            id="dept-name"
            placeholder="e.g. Engineering"
            {...register('name')}
            className={
              errors.name
                ? 'border-destructive outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
                : 'outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
            }
          />
          {errors.name && (
            <p className="text-xs text-destructive ml-2">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="dept-code" className="text-sm font-medium ml-2">
            Code (optional)
          </label>
          <Input
            id="dept-code"
            placeholder="e.g. ENG"
            {...register('code')}
            className={
              errors.code
                ? 'border-destructive outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
                : 'outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
            }
          />
          {errors.code && (
            <p className="text-xs text-destructive ml-2">{errors.code.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="dept-description" className="text-sm font-medium ml-2">
            Description (optional)
          </label>
          <Input
            id="dept-description"
            placeholder="Short description of the department"
            className='focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary!'
            {...register('description')}
          />
          {errors.description && (
            <p className="text-xs text-destructive ml-2">
              {errors.description.message}
            </p>
          )}
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
            {isSubmitting ? 'Creating…' : 'Create department'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function CreateDepartmentModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateDepartmentModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <CreateDepartmentFormBody
            key="create-department-form"
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

