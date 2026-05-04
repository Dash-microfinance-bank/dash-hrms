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
import type { EmployeeLevelRow } from '@/lib/data/employee-levels'
import { updateEmployeeLevel } from '@/lib/actions/employee-levels'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(120, 'Name is too long').trim(),
})

type FormValues = z.infer<typeof schema>

type EditLevelModalProps = {
  level: EmployeeLevelRow
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function EditLevelFormBody({
  level,
  onOpenChange,
  onSuccess,
}: Omit<EditLevelModalProps, 'open'>) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: level.name },
  })

  const onSubmit = async (values: FormValues) => {
    const result = await updateEmployeeLevel(level.id, { name: values.name })
    if (result.success) {
      toast.success('Level updated')
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit level</DialogTitle>
        <DialogDescription>Update this employee level name.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="edit-level-name" className="ml-2 text-sm font-medium">
            Name
          </label>
          <Input
            id="edit-level-name"
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
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function EditLevelModal({ level, open, onOpenChange, onSuccess }: EditLevelModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <EditLevelFormBody
            key={level.id}
            level={level}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
