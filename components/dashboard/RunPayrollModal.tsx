'use client'

import React, { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
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
import { Label } from '@/components/ui/label'
import { createPayrollRun } from '@/lib/actions/payroll-runs'
import type { PayFrequency, PayGroupRow } from '@/lib/data/pay-groups'
import {
  runPayrollFormSchemaWithPayGroups,
  type RunPayrollFormValues,
} from '@/lib/validations/run-payroll'

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const selectClassName =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50'

type RunPayrollModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  payGroups: PayGroupRow[]
}

function defaultFormValues(): RunPayrollFormValues {
  const month = new Date().getMonth() + 1
  return {
    month,
    pay_group_id: '',
    week_of_month: null,
    half_of_month: null,
  }
}

export function RunPayrollModal({ open, onOpenChange, payGroups }: RunPayrollModalProps) {
  const router = useRouter()
  const displayYear = new Date().getFullYear()

  const schema = useMemo(() => runPayrollFormSchemaWithPayGroups(payGroups), [payGroups])

  const form = useForm<RunPayrollFormValues>({
    resolver: zodResolver(schema) as Resolver<RunPayrollFormValues>,
    defaultValues: defaultFormValues(),
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = form

  const payGroupId = watch('pay_group_id')
  const selected = useMemo(
    () => payGroups.find((g) => g.id === payGroupId),
    [payGroupId, payGroups]
  )
  const frequency: PayFrequency | null | undefined = selected?.pay_frequency

  useEffect(() => {
    if (!open) return
    reset(defaultFormValues())
  }, [open, reset])

  useEffect(() => {
    setValue('week_of_month', null)
    setValue('half_of_month', null)
  }, [payGroupId, setValue])

  const onSubmit = async (values: RunPayrollFormValues) => {
    const payload: RunPayrollFormValues = {
      month: values.month,
      pay_group_id: values.pay_group_id,
      week_of_month:
        frequency === 'WEEKLY' ? values.week_of_month ?? null : null,
      half_of_month:
        frequency === 'BI_WEEKLY' ? values.half_of_month ?? null : null,
    }

    const result = await createPayrollRun(payload)
    if (result.success) {
      toast.success('Payroll run created')
      onOpenChange(false)
      router.push(`/dashboard/admin/payroll/${result.payrollRunId}`)
      return
    }
    toast.error(result.error)
  }

  const noGroups = payGroups.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Run payroll</DialogTitle>
          <DialogDescription>
            Create a new regular payroll run for a pay group and calendar month.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Year: <span className="font-medium text-foreground">{displayYear}</span> (current
            calendar year)
          </p>

          {noGroups ? (
            <p className="text-sm text-muted-foreground">
              There are no active pay groups. Enable a pay group before running payroll.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="run-payroll-month">Month</Label>
                <select id="run-payroll-month" className={`${selectClassName} focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!`} {...register('month')}>
                  {MONTH_LABELS.map((label, i) => (
                    <option key={label} value={i + 1}>
                      {label}
                    </option>
                  ))}
                </select>
                {errors.month ? (
                  <p className="text-sm text-destructive">{errors.month.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="run-payroll-group">Pay group</Label>
                <select
                  id="run-payroll-group"
                  className={`${selectClassName} focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!`}
                  {...register('pay_group_id')}
                >
                  <option value="">Select pay group…</option>
                  {payGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name?.trim() || 'Unnamed'} ({g.pay_frequency ?? '—'})
                    </option>
                  ))}
                </select>
                {errors.pay_group_id ? (
                  <p className="text-sm text-destructive">{errors.pay_group_id.message}</p>
                ) : null}
              </div>

              {frequency === 'WEEKLY' ? (
                <div className="space-y-2">
                  <Label htmlFor="run-payroll-week">Week of the month</Label>
                  <select
                    id="run-payroll-week"
                    className={`${selectClassName} focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!`}
                    {...register('week_of_month', {
                      setValueAs: (v: string) => (v === '' ? null : Number(v)),
                    })}
                  >
                    <option value="">Select week…</option>
                    {[1, 2, 3, 4].map((w) => (
                      <option key={w} value={w}>
                        Week {w}
                      </option>
                    ))}
                  </select>
                  {errors.week_of_month ? (
                    <p className="text-sm text-destructive">{errors.week_of_month.message}</p>
                  ) : null}
                </div>
              ) : null}

              {frequency === 'BI_WEEKLY' ? (
                <div className="space-y-2">
                  <Label htmlFor="run-payroll-half">Half of the month</Label>
                  <select
                    id="run-payroll-half"
                    className={`${selectClassName} focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!`}
                    {...register('half_of_month', {
                      setValueAs: (v: string) => (v === '' ? null : Number(v)),
                    })}
                  >
                    <option value="">Select half…</option>
                    <option value={1}>1st half of the month</option>
                    <option value={2}>2nd half of the month</option>
                  </select>
                  {errors.half_of_month ? (
                    <p className="text-sm text-destructive">{errors.half_of_month.message}</p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || noGroups}>
              {isSubmitting ? 'Generating…' : 'Initiate run'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
