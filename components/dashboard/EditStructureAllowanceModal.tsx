'use client'

import React from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
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
import type { EarningStructureAllowanceRow } from '@/lib/data/earning-structure-detail'
import { updateStructureAllowanceAssignment } from '@/lib/actions/earning-structure-components'

const schema = z.object({
  value: z.number().min(0, 'Value cannot be negative'),
})

type FormValues = z.infer<typeof schema>

type EditStructureAllowanceModalProps = {
  row: EarningStructureAllowanceRow
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function EditStructureAllowanceFormBody({
  row,
  onOpenChange,
  onSuccess,
}: Omit<EditStructureAllowanceModalProps, 'open'>) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      value: row.value ?? 0,
    },
  })

  const onSubmit = async (values: FormValues) => {
    const result = await updateStructureAllowanceAssignment(row.assignment_id, {
      value: values.value,
    })

    if (result.success) {
      toast.success('Allowance assignment updated')
      onSuccess()
      onOpenChange(false)
      return
    }

    toast.error(result.error)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit allowance value</DialogTitle>
        <DialogDescription>Update the assigned value for {row.allowance_name}.</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="edit-structure-allowance-value">Value</Label>
          <Input
            id="edit-structure-allowance-value"
            type="number"
            step="0.01"
            min={0}
            {...register('value', { valueAsNumber: true })}
            className={
              errors.value
                ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
                : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
            }
          />
          {errors.value ? <p className="text-xs text-destructive">{errors.value.message}</p> : null}
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

export function EditStructureAllowanceModal({
  row,
  open,
  onOpenChange,
  onSuccess,
}: EditStructureAllowanceModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <EditStructureAllowanceFormBody
            key={row.assignment_id}
            row={row}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
