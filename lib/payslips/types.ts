export type PayslipLineItem = {
  name: string
  amount: number
}

export type PayslipViewModel = {
  logoUrl: string
  periodLabel: string
  payDayLabel: string
  organizationName: string
  organizationAddressLines: string[]
  employeeStaffId: string
  employeeName: string
  department: string
  position: string
  contractLabel: string
  allowances: PayslipLineItem[]
  totalAllowances: number
  deductions: PayslipLineItem[]
  totalDeductions: number
  netSalary: number
}

export type PayslipStatus = 'PENDING' | 'GENERATED' | 'FAILED' | 'EMAILED'

export const DEFAULT_PAYSLIP_LOGO_URL =
  'https://dash-mfb.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fdash.5f00dc32.png&w=1080&q=75'
