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
import type { GradeRow } from '@/lib/data/grades'
import { updateGrade } from '@/lib/actions/grades'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const editGradeSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(120, 'Name is too long').trim(),
    code: z
      .string()
      .max(20, 'Code is too long')
      .trim()
      .optional()
      .or(z.literal('')),
    level: z
      .string()
      .optional()
      .transform((val) => (val && val.trim() !== '' ? Number(val) : null))
      .refine((val) => val === null || Number.isInteger(val), {
        message: 'Level must be a whole number',
      }),
    min_salary: z
      .string()
      .optional()
      .transform((val) => (val && val.trim() !== '' ? Number(val.replace(/,/g, '')) : null))
      .refine((val) => val === null || !Number.isNaN(val), {
        message: 'Enter a valid minimum salary',
      }),
    max_salary: z
      .string()
      .optional()
      .transform((val) => (val && val.trim() !== '' ? Number(val.replace(/,/g, '')) : null))
      .refine((val) => val === null || !Number.isNaN(val), {
        message: 'Enter a valid maximum salary',
      }),
    currency: z
      .string()
      .max(10, 'Currency code is too long')
      .trim()
      .optional()
      .or(z.literal('')),
  })
  .refine(
    (values) =>
      values.min_salary === null ||
      values.max_salary === null ||
      values.min_salary <= values.max_salary,
    {
      message: 'Minimum salary cannot be greater than maximum salary',
      path: ['min_salary'],
    }
  )

type EditGradeFormValues = z.infer<typeof editGradeSchema>

type EditGradeModalProps = {
  grade: GradeRow
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function formatNumericToInput(value: string | null): string {
  if (!value) return ''
  // Supabase returns numeric as string; strip trailing zeros and decimal when .00
  const num = Number(value)
  if (Number.isNaN(num)) return ''
  return String(num)
}

function EditGradeFormBody({
  grade,
  onOpenChange,
  onSuccess,
}: Omit<EditGradeModalProps, 'open'>) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditGradeFormValues>({
    resolver: zodResolver(editGradeSchema),
    defaultValues: {
      name: grade.name,
      code: grade.code ?? '',
      level: grade.level !== null && grade.level !== undefined ? String(grade.level) : '',
      min_salary: formatNumericToInput(grade.min_salary),
      max_salary: formatNumericToInput(grade.max_salary),
      currency: grade.currency || 'NGN',
    } as any,
  })

  const onSubmit = async (values: EditGradeFormValues) => {
    const result = await updateGrade(grade.id, {
      name: values.name,
      code: values.code || null,
      level: values.level,
      min_salary: values.min_salary,
      max_salary: values.max_salary,
      currency: values.currency && values.currency.trim() !== '' ? values.currency : 'NGN',
    })

    if (result.success) {
      toast.success('Grade updated')
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit grade</DialogTitle>
        <DialogDescription>
          Update the grade details. Changes apply only within this organization.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="edit-grade-name" className="ml-2 text-sm font-medium">
            Name
          </label>
          <Input
            id="edit-grade-name"
            placeholder="e.g. Junior"
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="edit-grade-code" className="ml-2 text-sm font-medium">
              Code (optional)
            </label>
            <Input
              id="edit-grade-code"
              placeholder="e.g. JR"
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
            <label htmlFor="edit-grade-level" className="ml-2 text-sm font-medium">
              Level (optional)
            </label>
            <Input
              id="edit-grade-level"
              placeholder="e.g. 1"
              {...register('level' as any)}
              className={
                errors.level
                  ? 'border-destructive outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
                  : 'outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
              }
            />
            {errors.level && (
              <p className="ml-2 text-xs text-destructive">{errors.level.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="edit-grade-min-salary" className="ml-2 text-sm font-medium">
              Min salary (optional)
            </label>
            <Input
              id="edit-grade-min-salary"
              placeholder="e.g. 250000"
              {...register('min_salary' as any)}
              className={
                errors.min_salary
                  ? 'border-destructive outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
                  : 'outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
              }
            />
            {errors.min_salary && (
              <p className="ml-2 text-xs text-destructive">{errors.min_salary.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-grade-max-salary" className="ml-2 text-sm font-medium">
              Max salary (optional)
            </label>
            <Input
              id="edit-grade-max-salary"
              placeholder="e.g. 500000"
              {...register('max_salary' as any)}
              className={
                errors.max_salary
                  ? 'border-destructive outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
                  : 'outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
              }
            />
            {errors.max_salary && (
              <p className="ml-2 text-xs text-destructive">{errors.max_salary.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="edit-grade-currency" className="ml-2 text-sm font-medium">
            Currency
          </label>
          <Input
            id="edit-grade-currency"
            placeholder="e.g. NGN"
            {...register('currency')}
            className={
              errors.currency
                ? 'border-destructive outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
                : 'outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
            }
          />
          {errors.currency && (
            <p className="ml-2 text-xs text-destructive">{errors.currency.message}</p>
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

export function EditGradeModal({
  grade,
  open,
  onOpenChange,
  onSuccess,
}: EditGradeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <EditGradeFormBody
            key={grade.id}
            grade={grade}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

