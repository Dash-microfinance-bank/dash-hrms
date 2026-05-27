import type { PayrollRunType } from '@/lib/data/payroll-runs'

const MONTH_SLUGS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]

export function getMonthSlug(month: number): string {
  return MONTH_SLUGS[month - 1] ?? `month-${month}`
}

export function getPayrollTypeSlug(payrollType: PayrollRunType): string {
  return payrollType.toLowerCase()
}

/**
 * Object key inside the `organizations` storage bucket.
 * e.g. `{orgId}/payroll/2026/may/regular/{runId}/{employeeId}.pdf`
 */
export function buildPayslipObjectPath(params: {
  organizationId: string
  year: number
  month: number
  payrollType: PayrollRunType
  payrollRunId: string
  employeeId: string
}): string {
  const monthSlug = getMonthSlug(params.month)
  const typeSlug = getPayrollTypeSlug(params.payrollType)
  return `${params.organizationId}/payroll/${params.year}/${monthSlug}/${typeSlug}/${params.payrollRunId}/${params.employeeId}.pdf`
}
