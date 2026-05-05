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
import { createDeduction } from '@/lib/actions/deductions'
import {
  DEDUCTION_FORMULA_PAYE_NIGERIA,
  isPayeNigeriaDeductionFormula,
} from '@/lib/deduction-formula-options'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const schema = z
  .object({
    name: z.string().min(1, 'Name is required').max(120, 'Name is too long').trim(),
    calculation_type: z.enum(['FIXED', 'PERCENTAGE', 'FORMULA']),
    based_on: z.enum(['BASIC', 'GROSS', 'NONE']),
    reduces_taxable: z.boolean(),
    value: z.string().optional(),
    formula: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.calculation_type === 'PERCENTAGE' && value.based_on === 'NONE') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Based on is required for percentage calculation',
        path: ['based_on'],
      })
    }
    if (value.calculation_type === 'FORMULA') {
      if (!isPayeNigeriaDeductionFormula(value.formula)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Formula is required',
          path: ['formula'],
        })
      }
    } else {
      const n = Number((value.value ?? '').trim())
      if (!Number.isFinite(n)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Value is required',
          path: ['value'],
        })
      }
    }
  })

type FormValues = z.infer<typeof schema>

type CreateDeductionModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateDeductionModal({ open, onOpenChange, onSuccess }: CreateDeductionModalProps) {
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
      reduces_taxable: false,
      value: '',
      formula: '',
    },
  })

  const calculationType = watch('calculation_type')

  const onSubmit = async (values: FormValues) => {
    const calculationBase =
      values.calculation_type === 'FORMULA'
        ? 'TAXABLE'
        : values.calculation_type === 'PERCENTAGE'
          ? values.based_on
          : 'NONE'
    const reducesTaxable =
      values.calculation_type === 'FORMULA' ? false : values.reduces_taxable
    const valueNum =
      values.calculation_type === 'FORMULA'
        ? null
        : Number((values.value ?? '').trim())
    const formulaText =
      values.calculation_type === 'FORMULA' ? DEDUCTION_FORMULA_PAYE_NIGERIA : null

    const result = await createDeduction({
      name: values.name,
      calculation_type: values.calculation_type,
      calculation_base: calculationBase,
      reduces_taxable_income: reducesTaxable,
      value: valueNum,
      formula: formulaText,
    })

    if (result.success) {
      toast.success('Deduction created')
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
          <DialogTitle>Create deduction</DialogTitle>
          <DialogDescription>
            Add a deduction component and its organization payroll value.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deduction-name">Name</Label>
            <Input
              id="deduction-name"
              {...register('name')}
              placeholder="e.g. Staff loan repayment"
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
            <Label htmlFor="deduction-calculation-type">Calculation type</Label>
            <select
              id="deduction-calculation-type"
              {...register('calculation_type')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
            >
              <option value="FIXED">Fixed</option>
              <option value="PERCENTAGE">Percentage</option>
              <option value="FORMULA">Formula</option>
            </select>
          </div>

          {calculationType === 'PERCENTAGE' ? (
            <div className="space-y-2">
              <Label htmlFor="deduction-based-on">Based on</Label>
              <select
                id="deduction-based-on"
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

          {calculationType === 'FORMULA' ? (
            <div className="space-y-2">
              <Label htmlFor="deduction-formula">Formula</Label>
              <select
                id="deduction-formula"
                {...register('formula')}
                required
                className={
                  errors.formula
                    ? 'flex h-9 w-full rounded-md border border-destructive bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
                    : 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
                }
              >
                <option value="">Select formula</option>
                <option value={DEDUCTION_FORMULA_PAYE_NIGERIA}>{DEDUCTION_FORMULA_PAYE_NIGERIA}</option>
              </select>
              {errors.formula ? (
                <p className="text-xs text-destructive">{errors.formula.message}</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="deduction-value">Value</Label>
              <Input
                id="deduction-value"
                type="text"
                inputMode="decimal"
                {...register('value')}
                placeholder={calculationType === 'PERCENTAGE' ? 'e.g. 5 for 5%' : 'Amount'}
                className={
                  errors.value
                    ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
                    : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
                }
              />
              {errors.value ? (
                <p className="text-xs text-destructive">{errors.value.message}</p>
              ) : null}
            </div>
          )}

          {calculationType !== 'FORMULA' ? (
            <div className="flex items-center gap-2">
              <input
                id="deduction-reduces-taxable"
                type="checkbox"
                {...register('reduces_taxable')}
                className="size-4 rounded border-input"
              />
              <Label htmlFor="deduction-reduces-taxable" className="font-normal cursor-pointer">
                Reduces taxable income
              </Label>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
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
