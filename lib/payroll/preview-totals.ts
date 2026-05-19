import {
  grossFromBreakdown,
  normalizeBreakdownWithBase,
  roundMoney,
  type AllowanceBreakdownItem,
} from '@/lib/payroll/gross-calculator'
import {
  computePayrollDeductions,
  type ConfiguredDeductionLine,
} from '@/lib/payroll/tax-calculator'

export type PayrollPreviewTotals = {
  totalGross: number
  totalAllowances: number
  totalDeductions: number
  totalTax: number
  totalNet: number
}

export function buildBreakdownMapFromRows(
  rows: { id: string; base_salary: number; allowance_breakdown: AllowanceBreakdownItem[] }[]
): Record<string, AllowanceBreakdownItem[]> {
  const m: Record<string, AllowanceBreakdownItem[]> = {}
  for (const r of rows) {
    m[r.id] = normalizeBreakdownWithBase(
      r.base_salary,
      r.allowance_breakdown.map((x) => ({ ...x }))
    )
  }
  return m
}

export function computePayrollPreviewTotals(
  rows: { id: string; base_salary: number }[],
  breakdownByEmployeeId: Record<string, AllowanceBreakdownItem[]>,
  configuredDeductions: ConfiguredDeductionLine[] = []
): PayrollPreviewTotals {
  let totalGross = 0
  let totalAllowances = 0
  let totalDeductions = 0
  let totalTax = 0
  let totalNet = 0
  for (const r of rows) {
    const gross = grossFromBreakdown(breakdownByEmployeeId[r.id] ?? [])
    const deductions = computePayrollDeductions({ gross, baseSalary: r.base_salary, configuredDeductions })
    totalGross += gross
    totalAllowances += Math.max(0, gross - r.base_salary)
    totalDeductions += deductions.totalDeductions
    totalTax += deductions.tax
    totalNet += deductions.net
  }
  return {
    totalGross: roundMoney(totalGross),
    totalAllowances: roundMoney(totalAllowances),
    totalDeductions: roundMoney(totalDeductions),
    totalTax: roundMoney(totalTax),
    totalNet: roundMoney(totalNet),
  }
}
