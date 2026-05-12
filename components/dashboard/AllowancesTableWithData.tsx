import { getSalaryComponentsForCurrentOrg } from '@/lib/data/salary-components'
import { AllowancesTable } from '@/components/dashboard/AllowancesTable'

export async function AllowancesTableWithData() {
  const allowances = await getSalaryComponentsForCurrentOrg('ALLOWANCE')
  return <AllowancesTable data={allowances} />
}
