import { z } from 'zod'
import type { PayFrequency } from '@/lib/data/pay-groups'

/** Client + server shared field shape */
export const runPayrollFormFieldsSchema = z.object({
  month: z.coerce.number().int().min(1, 'Select a month').max(12, 'Select a month'),
  pay_group_id: z.string().uuid('Select a pay group'),
  week_of_month: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
    .optional()
    .nullable(),
  half_of_month: z.union([z.literal(1), z.literal(2)]).optional().nullable(),
})

export type RunPayrollFormValues = z.infer<typeof runPayrollFormFieldsSchema>

export function refineRunPayrollByFrequency(
  data: RunPayrollFormValues,
  frequency: PayFrequency | null
): z.ZodIssue[] {
  const issues: z.ZodIssue[] = []

  if (frequency === 'WEEKLY') {
    if (data.week_of_month == null || ![1, 2, 3, 4].includes(data.week_of_month)) {
      issues.push({
        code: z.ZodIssueCode.custom,
        message: 'Select week 1, 2, 3, or 4',
        path: ['week_of_month'],
      })
    }
    if (data.half_of_month != null) {
      issues.push({
        code: z.ZodIssueCode.custom,
        message: 'Half of month does not apply to weekly pay groups',
        path: ['half_of_month'],
      })
    }
  } else if (frequency === 'BI_WEEKLY') {
    if (data.half_of_month == null || ![1, 2].includes(data.half_of_month)) {
      issues.push({
        code: z.ZodIssueCode.custom,
        message: 'Select 1st half or 2nd half',
        path: ['half_of_month'],
      })
    }
    if (data.week_of_month != null) {
      issues.push({
        code: z.ZodIssueCode.custom,
        message: 'Week of month does not apply to bi-weekly pay groups',
        path: ['week_of_month'],
      })
    }
  } else {
    if (data.week_of_month != null) {
      issues.push({
        code: z.ZodIssueCode.custom,
        message: 'Week of month only applies to weekly pay groups',
        path: ['week_of_month'],
      })
    }
    if (data.half_of_month != null) {
      issues.push({
        code: z.ZodIssueCode.custom,
        message: 'Half of month only applies to bi-weekly pay groups',
        path: ['half_of_month'],
      })
    }
  }

  return issues
}

/** Maps validated form + frequency to DB `period` (null for MONTHLY/DAILY). */
export function derivePeriodForPayrollRun(
  frequency: PayFrequency | null,
  data: RunPayrollFormValues
): number | null {
  if (frequency === 'WEEKLY') return data.week_of_month ?? null
  if (frequency === 'BI_WEEKLY') return data.half_of_month ?? null
  return null
}

/** Client form: validates period fields against the selected pay group’s frequency. */
export function runPayrollFormSchemaWithPayGroups(
  payGroups: { id: string; pay_frequency: PayFrequency | null }[]
) {
  const byId = new Map(payGroups.map((g) => [g.id, g]))
  return runPayrollFormFieldsSchema.superRefine((data, ctx) => {
    const group = byId.get(data.pay_group_id)
    if (!group) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select a pay group',
        path: ['pay_group_id'],
      })
      return
    }
    for (const issue of refineRunPayrollByFrequency(data, group.pay_frequency)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: issue.message ?? 'Validation failed',
        path: issue.path,
      })
    }
  })
}
