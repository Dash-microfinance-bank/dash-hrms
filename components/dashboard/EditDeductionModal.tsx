'use client'

import React, { useMemo } from 'react'
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
import type { DeductionTableRow } from '@/lib/data/deductions'
import { updateDeduction } from '@/lib/actions/deductions'
import {
  DEDUCTION_FORMULA_PAYE_NIGERIA,
  isPayeNigeriaDeductionFormula,
  isPayeNigeriaFormulaDeductionRow,
  PAYE_NIGERIA_FORMULA_DEDUCTION_DUPLICATE_ERROR,
} from '@/lib/deduction-formula-options'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const editDeductionFormValuesSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120, 'Name is too long').trim(),
  calculation_type: z.enum(['FIXED', 'PERCENTAGE', 'FORMULA']),
  based_on: z.enum(['BASIC', 'GROSS', 'NONE']),
  reduces_taxable: z.boolean(),
  value: z.string().optional(),
  formula: z.string().optional(),
})

type FormValues = z.infer<typeof editDeductionFormValuesSchema>

function editDeductionFormSchema(opts: { otherRowHasPayeNigeria: boolean }) {
  return editDeductionFormValuesSchema.superRefine((value, ctx) => {
    if (value.calculation_type === 'PERCENTAGE' && value.based_on === 'NONE') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Based on is required for percentage calculation',
        path: ['based_on'],
      })
    }
    if (value.calculation_type === 'FORMULA') {
      if (
        opts.otherRowHasPayeNigeria &&
        isPayeNigeriaDeductionFormula(value.formula)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: PAYE_NIGERIA_FORMULA_DEDUCTION_DUPLICATE_ERROR,
          path: ['calculation_type'],
        })
        return
      }
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
}

type EditDeductionModalProps = {
  deduction: DeductionTableRow
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  existingDeductions: DeductionTableRow[]
}

function defaultFormula(d: DeductionTableRow): string {
  return (d.payroll_formula ?? d.formula ?? '').trim()
}

function defaultValueString(d: DeductionTableRow): string {
  if (d.payroll_value == null) return ''
  return String(d.payroll_value)
}

function EditDeductionFormBody({
  deduction,
  existingDeductions,
  onOpenChange,
  onSuccess,
}: Omit<EditDeductionModalProps, 'open'>) {
  const otherRowHasPayeNigeria = useMemo(
    () =>
      existingDeductions.some(
        (r) => r.id !== deduction.id && isPayeNigeriaFormulaDeductionRow(r)
      ),
    [existingDeductions, deduction.id]
  )

  const resolver = useMemo(
    () => zodResolver(editDeductionFormSchema({ otherRowHasPayeNigeria })),
    [otherRowHasPayeNigeria]
  )

  const ct = deduction.calculation_type ?? 'FIXED'
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver,
    defaultValues: {
      name: deduction.name ?? '',
      calculation_type: ct === 'PERCENTAGE' || ct === 'FORMULA' ? ct : 'FIXED',
      based_on:
        deduction.calculation_base === 'BASIC' || deduction.calculation_base === 'GROSS'
          ? deduction.calculation_base
          : 'NONE',
      reduces_taxable: deduction.reduces_taxable_income ?? false,
      value: ct === 'FORMULA' ? '' : defaultValueString(deduction),
      formula:
        ct === 'FORMULA' && isPayeNigeriaDeductionFormula(defaultFormula(deduction))
          ? DEDUCTION_FORMULA_PAYE_NIGERIA
          : '',
    },
  })

  const calculationType = watch('calculation_type')

  const onSubmit = async (values: FormValues) => {
    if (
      values.calculation_type === 'FORMULA' &&
      otherRowHasPayeNigeria &&
      isPayeNigeriaDeductionFormula(values.formula)
    ) {
      toast.error(PAYE_NIGERIA_FORMULA_DEDUCTION_DUPLICATE_ERROR)
      return
    }

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

    const result = await updateDeduction(deduction.id, {
      name: values.name,
      calculation_type: values.calculation_type,
      calculation_base: calculationBase,
      reduces_taxable_income: reducesTaxable,
      value: valueNum,
      formula: formulaText,
    })

    if (result.success) {
      toast.success('Deduction updated')
      onSuccess()
      onOpenChange(false)
      return
    }
    toast.error(result.error)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit deduction</DialogTitle>
        <DialogDescription>
          Update this deduction and its payroll value or formula.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="edit-deduction-name">Name</Label>
          <Input
            id="edit-deduction-name"
            {...register('name')}
            className={
              errors.name
                ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
                : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
            }
          />
          {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-deduction-calculation-type">Calculation type</Label>
          <select
            id="edit-deduction-calculation-type"
            {...register('calculation_type')}
            className={
              errors.calculation_type
                ? 'flex h-9 w-full rounded-md border border-destructive bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
                : 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
            }
          >
            <option value="FIXED">Fixed</option>
            <option value="PERCENTAGE">Percentage</option>
            <option value="FORMULA" disabled={otherRowHasPayeNigeria}>
              Formula
              {otherRowHasPayeNigeria ? ' (PAYE already configured)' : ''}
            </option>
          </select>
          {errors.calculation_type ? (
            <p className="text-xs text-destructive">{errors.calculation_type.message}</p>
          ) : null}
        </div>

        {calculationType === 'PERCENTAGE' ? (
          <div className="space-y-2">
            <Label htmlFor="edit-deduction-based-on">Based on</Label>
            <select
              id="edit-deduction-based-on"
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
            <Label htmlFor="edit-deduction-formula">Formula</Label>
            <select
              id="edit-deduction-formula"
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
            <Label htmlFor="edit-deduction-value">Value</Label>
            <Input
              id="edit-deduction-value"
              type="text"
              inputMode="decimal"
              {...register('value')}
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
              id="edit-deduction-reduces-taxable"
              type="checkbox"
              {...register('reduces_taxable')}
              className="size-4 rounded border-input"
            />
            <Label htmlFor="edit-deduction-reduces-taxable" className="font-normal cursor-pointer">
              Reduces taxable income
            </Label>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
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

export function EditDeductionModal({
  deduction,
  open,
  onOpenChange,
  onSuccess,
  existingDeductions,
}: EditDeductionModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <EditDeductionFormBody
            key={deduction.id}
            deduction={deduction}
            existingDeductions={existingDeductions}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
