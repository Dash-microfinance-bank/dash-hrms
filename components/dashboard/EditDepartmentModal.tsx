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
import type { DepartmentRow } from '@/lib/data/departments'
import { updateDepartment } from '@/lib/actions/departments'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const editDepartmentSchema = z.object({
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
  is_active: z.boolean().optional(),
})

type EditDepartmentFormValues = z.infer<typeof editDepartmentSchema>

type EditDepartmentModalProps = {
  department: DepartmentRow
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function EditDepartmentFormBody({
  department,
  onOpenChange,
  onSuccess,
}: Omit<EditDepartmentModalProps, 'open'>) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditDepartmentFormValues>({
    resolver: zodResolver(editDepartmentSchema),
    defaultValues: {
      name: department.name,
      code: department.code ?? '',
      description: department.description ?? '',
      is_active: department.is_active,
    },
  })

  const onSubmit = async (values: EditDepartmentFormValues) => {
    const result = await updateDepartment(department.id, {
      name: values.name,
      code: values.code || null,
      description: values.description || null,
      is_active: values.is_active ?? true,
    })

    if (result.success) {
      toast.success('Department updated')
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit department</DialogTitle>
        <DialogDescription>
          Update the department details. Changes will apply only within this organization.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="edit-dept-name" className="text-sm font-medium ml-2">
            Name
          </label>
          <Input
            id="edit-dept-name"
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
          <label htmlFor="edit-dept-code" className="text-sm font-medium ml-2">
            Code (optional)
          </label>
          <Input
            id="edit-dept-code"
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
          <label htmlFor="edit-dept-description" className="text-sm font-medium ml-2">
            Description (optional)
          </label>
          <Input
            id="edit-dept-description"
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
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function EditDepartmentModal({
  department,
  open,
  onOpenChange,
  onSuccess,
}: EditDepartmentModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <EditDepartmentFormBody
            key={department.id}
            department={department}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

