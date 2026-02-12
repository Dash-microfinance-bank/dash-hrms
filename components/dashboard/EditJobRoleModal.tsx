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
import type { JobRoleRow } from '@/lib/data/job-roles'
import { updateJobRole } from '@/lib/actions/job-roles'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const editJobRoleSchema = z.object({
  name: z.string().min(1, 'Title is required').max(120, 'Title is too long').trim(),
  code: z
    .string()
    .max(20, 'Code is too long')
    .trim()
    .optional()
    .or(z.literal('')),
  department_id: z.string().min(1, 'Department is required'),
})

type EditJobRoleFormValues = z.infer<typeof editJobRoleSchema>

type EditJobRoleModalProps = {
  jobRole: JobRoleRow
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  departments: DepartmentRow[]
}

function EditJobRoleFormBody({
  jobRole,
  onOpenChange,
  onSuccess,
  departments,
}: Omit<EditJobRoleModalProps, 'open'>) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditJobRoleFormValues>({
    resolver: zodResolver(editJobRoleSchema),
    defaultValues: {
      name: jobRole.name,
      code: jobRole.code ?? '',
      department_id: jobRole.department_id,
    },
  })

  const onSubmit = async (values: EditJobRoleFormValues) => {
    const result = await updateJobRole(jobRole.id, {
      name: values.name,
      code: values.code || null,
      department_id: values.department_id,
    })

    if (result.success) {
      toast.success('Job role updated')
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
        <DialogTitle>Edit job role</DialogTitle>
        <DialogDescription>
          Update the job role details. Changes apply only within this organization.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="edit-jobrole-title" className="ml-2 text-sm font-medium">
            Title
          </label>
          <Input
            id="edit-jobrole-title"
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
          <label htmlFor="edit-jobrole-code" className="ml-2 text-sm font-medium">
            Code (optional)
          </label>
          <Input
            id="edit-jobrole-code"
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
          <label htmlFor="edit-jobrole-department" className="ml-2 text-sm font-medium">
            Department
          </label>
          <select
            id="edit-jobrole-department"
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
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function EditJobRoleModal({
  jobRole,
  open,
  onOpenChange,
  onSuccess,
  departments,
}: EditJobRoleModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <EditJobRoleFormBody
            key={jobRole.id}
            jobRole={jobRole}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
            departments={departments}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

