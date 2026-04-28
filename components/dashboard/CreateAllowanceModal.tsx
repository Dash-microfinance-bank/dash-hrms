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
import { createAllowance } from '@/lib/actions/salary-components'
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

type CreateAllowanceModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateAllowanceModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateAllowanceModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      calculation_type: 'FIXED',
      based_on: 'NONE',
      taxable: true,
    },
  })

  const calculationType = watch('calculation_type')

  const onSubmit = async (values: FormValues) => {
    const calculationBase =
      values.calculation_type === 'PERCENTAGE' ? values.based_on : 'NONE'

    const result = await createAllowance({
      name: values.name,
      calculation_type: values.calculation_type,
      calculation_base: calculationBase,
      is_taxable: values.taxable,
    })

    if (result.success) {
      toast.success('Allowance created')
      reset()
      onSuccess()
      onOpenChange(false)
      return
    }

    toast.error(result.error)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create allowance</DialogTitle>
          <DialogDescription>
            Add a new allowance component for your organization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="allowance-name">Name</Label>
            <Input
              id="allowance-name"
              {...register('name')}
              placeholder="e.g. Housing Allowance"
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
            <Label htmlFor="allowance-calculation-type">Calculation type</Label>
            <select
              id="allowance-calculation-type"
              {...register('calculation_type')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
            >
              <option value="FIXED">Fixed</option>
              <option value="PERCENTAGE">Percentage</option>
            </select>
          </div>

          {calculationType === 'PERCENTAGE' ? (
            <div className="space-y-2">
              <Label htmlFor="allowance-based-on">Based on</Label>
              <select
                id="allowance-based-on"
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
              id="allowance-taxable"
              type="checkbox"
              {...register('taxable')}
              className="size-4 rounded border-input"
            />
            <Label htmlFor="allowance-taxable" className="font-normal cursor-pointer">
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
              {isSubmitting ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
