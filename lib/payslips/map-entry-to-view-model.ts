import type { AllowanceBreakdownItem } from '@/lib/payroll/gross-calculator'
import { roundMoney } from '@/lib/payroll/gross-calculator'
import type { PayrollDeductionBreakdownItem } from '@/lib/payroll/tax-calculator'
import { formatContractType } from '@/lib/payslips/contract-label'
import {
  organizationAddressLines,
  parseOrganizationSettings,
  type OrganizationSettings,
} from '@/lib/payslips/org-settings'
import { DEFAULT_PAYSLIP_LOGO_URL, type PayslipLineItem, type PayslipViewModel } from '@/lib/payslips/types'

const MONTH_NAMES = [
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

export type PayslipRunMeta = {
  year: number
  month: number
}

export type PayslipEntryInput = {
  staffId: string
  firstName: string
  lastName: string
  department: string
  position: string
  contractType: string | null
  allowanceBreakdown: AllowanceBreakdownItem[]
  deductionsBreakdown: PayrollDeductionBreakdownItem[]
  netSalary: number
}

export type PayslipOrgInput = {
  name: string
  settings: unknown
}

function parseMoney(v: number | string | null | undefined): number {
  if (v == null) return 0
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function toLineItems(
  items: Array<{ name: string; amount: number }>
): PayslipLineItem[] {
  return items.map((item) => ({
    name: item.name,
    amount: roundMoney(item.amount),
  }))
}

export function formatPayslipPeriodLabel(year: number, month: number): string {
  const monthName = MONTH_NAMES[month - 1] ?? `M${month}`
  return `${monthName}, ${year}`
}

export function mapEntryToPayslipViewModel(
  entry: PayslipEntryInput,
  run: PayslipRunMeta,
  org: PayslipOrgInput
): PayslipViewModel {
  const settings: OrganizationSettings = parseOrganizationSettings(org.settings)
  const periodLabel = formatPayslipPeriodLabel(run.year, run.month)
  const payDayLabel = periodLabel

  const allowances = toLineItems(
    (entry.allowanceBreakdown ?? []).map((line) => ({
      name: line.name,
      amount: parseMoney(line.amount),
    }))
  )
  const totalAllowances = roundMoney(
    allowances.reduce((sum, line) => sum + line.amount, 0)
  )

  const deductions = toLineItems(
    (entry.deductionsBreakdown ?? []).map((line) => ({
      name: line.name,
      amount: parseMoney(line.amount),
    }))
  )
  const totalDeductions = roundMoney(
    deductions.reduce((sum, line) => sum + line.amount, 0)
  )

  const addressLines = organizationAddressLines(settings)

  return {
    logoUrl: settings.logoUrl ?? DEFAULT_PAYSLIP_LOGO_URL,
    periodLabel,
    payDayLabel,
    organizationName: org.name,
    organizationAddressLines: addressLines,
    employeeStaffId: entry.staffId,
    employeeName: `${entry.firstName} ${entry.lastName}`.trim(),
    department: entry.department || '—',
    position: entry.position || '—',
    contractLabel: formatContractType(entry.contractType),
    allowances,
    totalAllowances,
    deductions,
    totalDeductions,
    netSalary: roundMoney(parseMoney(entry.netSalary)),
  }
}
