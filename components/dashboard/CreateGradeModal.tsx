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
import { createGrade } from '@/lib/actions/grades'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const createGradeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120, 'Name is too long').trim(),
  code: z
    .string()
    .max(20, 'Code is too long')
    .trim()
    .optional()
    .or(z.literal('')),
  level: z.string().optional(),
  min_salary: z.string().optional(),
  max_salary: z.string().optional(),
  currency: z
    .string()
    .max(10, 'Currency code is too long')
    .trim()
    .optional()
    .or(z.literal('')),
})

type CreateGradeFormValues = z.infer<typeof createGradeSchema>

type CreateGradeModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function CreateGradeFormBody({
  onOpenChange,
  onSuccess,
}: Pick<CreateGradeModalProps, 'onOpenChange' | 'onSuccess'>) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateGradeFormValues>({
    resolver: zodResolver(createGradeSchema),
    defaultValues: {
      name: '',
      code: '',
      level: '',
      min_salary: '',
      max_salary: '',
      currency: 'NGN',
    },
  })

  const onSubmit = async (values: CreateGradeFormValues) => {
    // Parse numeric fields from strings
    const levelStr = values.level?.trim() ?? ''
    const level =
      levelStr.length > 0 ? Number(levelStr) : null

    if (levelStr.length > 0 && (!Number.isFinite(level) || !Number.isInteger(level))) {
      toast.error('Level must be a whole number')
      return
    }

    const parseMoney = (input: string | undefined) => {
      const raw = input?.trim()
      if (!raw) return null
      const num = Number(raw.replace(/,/g, ''))
      return Number.isFinite(num) ? num : NaN
    }

    const minSalary = parseMoney(values.min_salary)
    const maxSalary = parseMoney(values.max_salary)

    if (values.min_salary && Number.isNaN(minSalary)) {
      toast.error('Enter a valid minimum salary')
      return
    }

    if (values.max_salary && Number.isNaN(maxSalary)) {
      toast.error('Enter a valid maximum salary')
      return
    }

    if (
      minSalary !== null &&
      !Number.isNaN(minSalary) &&
      maxSalary !== null &&
      !Number.isNaN(maxSalary) &&
      minSalary > maxSalary
    ) {
      toast.error('Minimum salary cannot be greater than maximum salary')
      return
    }

    const result = await createGrade({
      name: values.name,
      code: values.code || null,
      level,
      min_salary:
        minSalary !== null && !Number.isNaN(minSalary) ? minSalary : null,
      max_salary:
        maxSalary !== null && !Number.isNaN(maxSalary) ? maxSalary : null,
      currency:
        values.currency && values.currency.trim() !== ''
          ? values.currency.trim()
          : 'NGN',
    })

    if (result.success) {
      toast.success('Grade created')
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create grade</DialogTitle>
        <DialogDescription>
          Define a new compensation grade for this organization. Grades are scoped per
          organization.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="grade-name" className="ml-2 text-sm font-medium">
            Name
          </label>
          <Input
            id="grade-name"
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
            <label htmlFor="grade-code" className="ml-2 text-sm font-medium">
              Code (optional)
            </label>
            <Input
              id="grade-code"
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
            <label htmlFor="grade-level" className="ml-2 text-sm font-medium">
              Level (optional)
            </label>
            <Input
              id="grade-level"
              placeholder="e.g. 1"
              {...register('level')}
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
            <label htmlFor="grade-min-salary" className="ml-2 text-sm font-medium">
              Min salary (optional)
            </label>
            <Input
              id="grade-min-salary"
              placeholder="e.g. 250000"
              {...register('min_salary')}
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
            <label htmlFor="grade-max-salary" className="ml-2 text-sm font-medium">
              Max salary (optional)
            </label>
            <Input
              id="grade-max-salary"
              placeholder="e.g. 500000"
              {...register('max_salary')}
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
          <label htmlFor="grade-currency" className="ml-2 text-sm font-medium">
            Currency
          </label>
          <Input
            id="grade-currency"
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
            {isSubmitting ? 'Creating…' : 'Create grade'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function CreateGradeModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateGradeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <CreateGradeFormBody
            key="create-grade-form"
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

