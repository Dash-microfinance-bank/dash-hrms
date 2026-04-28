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
import type { SalaryComponentRow } from '@/lib/data/salary-components'
import { updateAllowance } from '@/lib/actions/salary-components'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const schema = z
  .object({
    name: z.string().min(1, 'Name is required').max(120, 'Name is too long').trim(),
    calculation_type: z.enum(['FIXED', 'PERCENTAGE']),
    based_on: z.enum(['BASIC', 'GROSS', 'NONE']),
    taxable: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.calculation_type === 'PERCENTAGE' && value.based_on === 'NONE') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Based on is required for percentage calculation',
        path: ['based_on'],
      })
    }
  })

type FormValues = z.infer<typeof schema>

type EditAllowanceModalProps = {
  allowance: SalaryComponentRow
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function EditAllowanceFormBody({
  allowance,
  onOpenChange,
  onSuccess,
}: Omit<EditAllowanceModalProps, 'open'>) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: allowance.name ?? '',
      calculation_type:
        allowance.calculation_type === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED',
      based_on:
        allowance.calculation_base === 'BASIC' || allowance.calculation_base === 'GROSS'
          ? allowance.calculation_base
          : 'NONE',
      taxable: allowance.is_taxable ?? true,
    },
  })

  const calculationType = watch('calculation_type')

  const onSubmit = async (values: FormValues) => {
    const calculationBase =
      values.calculation_type === 'PERCENTAGE' ? values.based_on : 'NONE'

    const result = await updateAllowance(allowance.id, {
      name: values.name,
      calculation_type: values.calculation_type,
      calculation_base: calculationBase,
      is_taxable: values.taxable,
    })

    if (result.success) {
      toast.success('Allowance updated')
      onSuccess()
      onOpenChange(false)
      return
    }

    toast.error(result.error)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit allowance</DialogTitle>
        <DialogDescription>
          Update this allowance and save changes to your organization data.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="edit-allowance-name">Name</Label>
          <Input
            id="edit-allowance-name"
            {...register('name')}
            className={
              errors.name
                ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
                : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
            }
          />
          {errors.name ? (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-allowance-calculation-type">Calculation type</Label>
          <select
            id="edit-allowance-calculation-type"
            {...register('calculation_type')}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
          >
            <option value="FIXED">Fixed</option>
            <option value="PERCENTAGE">Percentage</option>
          </select>
        </div>

        {calculationType === 'PERCENTAGE' ? (
          <div className="space-y-2">
            <Label htmlFor="edit-allowance-based-on">Based on</Label>
            <select
              id="edit-allowance-based-on"
              {...register('based_on')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
            >
              <option value="NONE">Select base</option>
              <option value="BASIC">Base salary</option>
              <option value="GROSS">Gross salary</option>
            </select>
            {errors.based_on ? (
              <p className="text-xs text-destructive">{errors.based_on.message}</p>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <input
            id="edit-allowance-taxable"
            type="checkbox"
            {...register('taxable')}
            className="size-4 rounded border-input"
          />
          <Label htmlFor="edit-allowance-taxable" className="font-normal cursor-pointer">
            Taxable
          </Label>
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

export function EditAllowanceModal({
  allowance,
  open,
  onOpenChange,
  onSuccess,
}: EditAllowanceModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <EditAllowanceFormBody
            key={allowance.id}
            allowance={allowance}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
