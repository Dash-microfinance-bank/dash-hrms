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
import { createJobRole } from '@/lib/actions/job-roles'
import type { DepartmentRow } from '@/lib/data/departments'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const createJobRoleSchema = z.object({
  name: z.string().min(1, 'Title is required').max(120, 'Title is too long').trim(),
  code: z
    .string()
    .max(20, 'Code is too long')
    .trim()
    .optional()
    .or(z.literal('')),
  department_id: z.string().min(1, 'Department is required'),
})

type CreateJobRoleFormValues = z.infer<typeof createJobRoleSchema>

type CreateJobRoleModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  departments: DepartmentRow[]
}

function CreateJobRoleFormBody({
  onOpenChange,
  onSuccess,
  departments,
}: Pick<CreateJobRoleModalProps, 'onOpenChange' | 'onSuccess' | 'departments'>) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateJobRoleFormValues>({
    resolver: zodResolver(createJobRoleSchema),
    defaultValues: {
      name: '',
      code: '',
      department_id: '',
    },
  })

  const onSubmit = async (values: CreateJobRoleFormValues) => {
    const result = await createJobRole({
      name: values.name,
      code: values.code || null,
      department_id: values.department_id,
    })

    if (result.success) {
      toast.success('Job role created')
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  const activeDepartments = departments.filter((d) => d.is_active)

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create job role</DialogTitle>
        <DialogDescription>
          Define a new job role within this organization. Each role must belong to an existing
          department.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="jobrole-title" className="ml-2 text-sm font-medium">
            Title
          </label>
          <Input
            id="jobrole-title"
            placeholder="e.g. Software Engineer"
            {...register('name')}
            className={
              errors.name
                ? 'border-destructive outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
                : 'outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
            }
          />
          {errors.name && (
            <p className="ml-2 text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="jobrole-code" className="ml-2 text-sm font-medium">
            Code (optional)
          </label>
          <Input
            id="jobrole-code"
            placeholder="e.g. SE"
            {...register('code')}
            className={
              errors.code
                ? 'border-destructive outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
                : 'outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
            }
          />
          {errors.code && (
            <p className="ml-2 text-xs text-destructive">{errors.code.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="jobrole-department" className="ml-2 text-sm font-medium">
            Department
          </label>
          <select
            id="jobrole-department"
            {...register('department_id')}
            className={
              errors.department_id
                ? 'h-9 w-full rounded-md border border-destructive bg-background px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
                : 'h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
            }
          >
            <option value="">Select department</option>
            {activeDepartments.map((dept) => {
              const display =
                dept.code && dept.code.trim().length > 0
                  ? `${dept.name} (${dept.code.trim()})`
                  : dept.name
              return (
                <option key={dept.id} value={dept.id}>
                  {display}
                </option>
              )
            })}
          </select>
          {errors.department_id && (
            <p className="ml-2 text-xs text-destructive">{errors.department_id.message}</p>
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
            {isSubmitting ? 'Creating…' : 'Create job role'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function CreateJobRoleModal({
  open,
  onOpenChange,
  onSuccess,
  departments,
}: CreateJobRoleModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <CreateJobRoleFormBody
            key="create-jobrole-form"
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
            departments={departments}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

