import type { PayslipViewModel } from '@/lib/payslips/types'

export const SAMPLE_PAYSLIP_VIEW_MODEL: PayslipViewModel = {
  logoUrl:
    'https://dash-mfb.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fdash.5f00dc32.png&w=1080&q=75',
  periodLabel: 'May, 2026',
  payDayLabel: 'May, 2026',
  organizationName: 'Dash Microfinace Bank Limited',
  organizationAddressLines: [
    '5B Adewunmi Adu Street, Off Sanni Balogun, Abule-Egba',
    'Lagos, Nigeria.',
  ],
  employeeStaffId: 'EMP001',
  employeeName: 'Emmanuel Ufot',
  department: 'Information Technology',
  position: 'Software Engineer',
  contractLabel: 'Permanent',
  allowances: [{ name: 'Basic Salary', amount: 100_000 }],
  totalAllowances: 100_000,
  deductions: [
    { name: 'Pension', amount: 20_000 },
    { name: 'Tax', amount: 40_000 },
  ],
  totalDeductions: 60_000,
  netSalary: 40_000,
}
