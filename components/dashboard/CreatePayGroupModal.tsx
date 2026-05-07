'use client'

import React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { createPayGroup } from '@/lib/actions/pay-groups'

const weekdayOptions = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
] as const

function weekdayMon1Sun7(dateLike: string): number {
  const date = new Date(`${dateLike}T00:00:00.000Z`)
  const day = date.getUTCDay()
  return day === 0 ? 7 : day
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

const schema = z
  .object({
    name: z.string().min(1, 'Pay group name is required').max(120, 'Name is too long').trim(),
    pay_frequency: z.enum(['DAILY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY']),
    pay_day_type: z.enum(['FIXED_DAY', 'LAST_WORKING_DAY']),
    pay_day_of_month: z.string().optional(),
    pay_day_of_week: z.string().optional(),
    anchor_date: z.string().optional(),
    currency: z.literal('NGN'),
    description: z.string().optional(),
    auto_generate_payroll: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.pay_frequency === 'MONTHLY' && value.pay_day_type === 'FIXED_DAY') {
      const n = Number(value.pay_day_of_month ?? '')
      if (!Number.isInteger(n) || n < 1 || n > 31) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Pay day must be between 1 and 31',
          path: ['pay_day_of_month'],
        })
      }
    }

    if (value.pay_frequency === 'WEEKLY' || value.pay_frequency === 'BI_WEEKLY') {
      const w = Number(value.pay_day_of_week ?? '')
      if (!Number.isInteger(w) || w < 1 || w > 7) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select a valid day of the week',
          path: ['pay_day_of_week'],
        })
      }
    }

    if (value.pay_frequency === 'BI_WEEKLY') {
      const anchor = (value.anchor_date ?? '').trim()
      if (!anchor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Start date is required',
          path: ['anchor_date'],
        })
        return
      }

      if (anchor < todayIso()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Start date cannot be in the past',
          path: ['anchor_date'],
        })
      }

      const w = Number(value.pay_day_of_week ?? '')
      if (Number.isInteger(w) && w >= 1 && w <= 7) {
        if (weekdayMon1Sun7(anchor) !== w) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Start date must match selected pay day of the week',
            path: ['anchor_date'],
          })
        }
      }
    }
  })

type FormValues = z.infer<typeof schema>

type CreatePayGroupModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreatePayGroupModal({ open, onOpenChange, onSuccess }: CreatePayGroupModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      pay_frequency: 'MONTHLY',
      pay_day_type: 'FIXED_DAY',
      pay_day_of_month: '',
      pay_day_of_week: '1',
      anchor_date: '',
      currency: 'NGN',
      description: '',
      auto_generate_payroll: false,
    },
  })

  const payFrequency = watch('pay_frequency')
  const payDayType = watch('pay_day_type')

  React.useEffect(() => {
    if (payFrequency !== 'MONTHLY' && payDayType !== 'FIXED_DAY') {
      setValue('pay_day_type', 'FIXED_DAY', { shouldDirty: false, shouldValidate: false })
    }
  }, [payFrequency, payDayType, setValue])

  const showMonthlyFixedDay = payFrequency === 'MONTHLY' && payDayType === 'FIXED_DAY'
  const showWeekdaySelect = payFrequency === 'WEEKLY' || payFrequency === 'BI_WEEKLY'
  const showBiWeeklyStartDate = payFrequency === 'BI_WEEKLY'

  const onSubmit = async (values: FormValues) => {
    let payDay: number | null = null
    if (showMonthlyFixedDay) payDay = Number(values.pay_day_of_month ?? '')
    if (showWeekdaySelect) payDay = Number(values.pay_day_of_week ?? '')

    const result = await createPayGroup({
      name: values.name,
      pay_frequency: values.pay_frequency,
      pay_day_type: values.pay_day_type,
      pay_day: payDay,
      anchor_date: showBiWeeklyStartDate ? (values.anchor_date ?? null) : null,
      currency: 'NGN',
      description: (values.description ?? '').trim() || null,
      auto_generate_payroll: false,
    })

    if (result.success) {
      toast.success('Pay group created')
      reset()
      onSuccess()
      onOpenChange(false)
      return
    }

    toast.error(result.error)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create pay group</DialogTitle>
          <DialogDescription>
            Define payroll run timing and schedule behavior for a pay group.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pay-group-name">Pay group name</Label>
            <Input
              id="pay-group-name"
              {...register('name')}
              placeholder="e.g. Monthly Staff"
              className={
                errors.name
                  ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
                  : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
              }
            />
            {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-frequency">Frequency</Label>
            <select
              id="pay-frequency"
              {...register('pay_frequency')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="BI_WEEKLY">Bi-weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>

          {payFrequency === 'MONTHLY' ? (
            <div className="space-y-2">
              <Label htmlFor="pay-day-type">Payment schedule</Label>
              <select
                id="pay-day-type"
                {...register('pay_day_type')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
              >
                <option value="FIXED_DAY">Fixed day</option>
                <option value="LAST_WORKING_DAY">Last working day</option>
              </select>
            </div>
          ) : null}

          {showMonthlyFixedDay ? (
            <div className="space-y-2">
              <Label htmlFor="pay-day-of-month">Pay day (1 - 31)</Label>
              <Input
                id="pay-day-of-month"
                type="number"
                min={1}
                max={31}
                placeholder="e.g. 25"
                {...register('pay_day_of_month')}
                className={
                  errors.pay_day_of_month
                    ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
                    : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
                }
              />
              {errors.pay_day_of_month ? (
                <p className="text-xs text-destructive">{errors.pay_day_of_month.message}</p>
              ) : null}
            </div>
          ) : null}

          {showWeekdaySelect ? (
            <div className="space-y-2">
              <Label htmlFor="pay-day-of-week">Pay day of the week</Label>
              <select
                id="pay-day-of-week"
                {...register('pay_day_of_week')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
              >
                {weekdayOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {errors.pay_day_of_week ? (
                <p className="text-xs text-destructive">{errors.pay_day_of_week.message}</p>
              ) : null}
            </div>
          ) : null}

          {showBiWeeklyStartDate ? (
            <div className="space-y-2">
              <Label htmlFor="anchor-date">Start date</Label>
              <Input
                id="anchor-date"
                type="date"
                min={todayIso()}
                {...register('anchor_date')}
                className={
                  errors.anchor_date
                    ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
                    : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
                }
              />
              {errors.anchor_date ? (
                <p className="text-xs text-destructive">{errors.anchor_date.message}</p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <select
              id="currency"
              {...register('currency')}
              disabled
              className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm shadow-sm"
            >
              <option value="NGN">NGN</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              {...register('description')}
              placeholder="Short note about this pay group"
              className="focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="auto-generate-payroll"
              type="checkbox"
              {...register('auto_generate_payroll')}
              disabled
              className="size-4 rounded border-input"
            />
            <Label htmlFor="auto-generate-payroll" className="font-normal cursor-not-allowed">
              Automatically generate payroll (coming soon)
            </Label>
          </div>

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
