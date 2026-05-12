import { DeductionsTable } from '@/components/dashboard/DeductionsTable'
import { getDeductionsWithPayrollForCurrentOrg } from '@/lib/data/deductions'

export async function DeductionsTableWithData() {
  const deductions = await getDeductionsWithPayrollForCurrentOrg()
  return <DeductionsTable data={deductions} />
}
