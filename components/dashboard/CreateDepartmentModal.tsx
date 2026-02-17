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
  parent_department_id: z.string().optional().or(z.literal('')),
})

type CreateDepartmentFormValues = z.infer<typeof createDepartmentSchema>

type CreateDepartmentModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  departments: Array<{ id: string; name: string; code: string | null }>
}

function CreateDepartmentFormBody({
  departments,
  onOpenChange,
  onSuccess,
}: Pick<CreateDepartmentModalProps, 'departments' | 'onOpenChange' | 'onSuccess'>) {
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
      parent_department_id: '',
    },
  })

  const onSubmit = async (values: CreateDepartmentFormValues) => {
    const result = await createDepartment({
      name: values.name,
      code: values.code || null,
      description: values.description || null,
      parent_department_id: values.parent_department_id || null,
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
          <label htmlFor="dept-parent" className="text-sm font-medium ml-2">
            Parent department (optional)
          </label>
          <select
            id="dept-parent"
            {...register('parent_department_id')}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary md:text-sm"
          >
            <option value="">None</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code && d.code.trim() ? `${d.name} (${d.code.trim()})` : d.name}
              </option>
            ))}
          </select>
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
  departments,
}: CreateDepartmentModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <CreateDepartmentFormBody
            key="create-department-form"
            departments={departments}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

