import { PayrollRunsTable } from '@/components/dashboard/PayrollRunsTable'
import { getPayGroupsForCurrentOrg } from '@/lib/data/pay-groups'
import { getPayrollRunsForCurrentOrg } from '@/lib/data/payroll-runs'

export async function PayrollRunsTableWithData() {
  const [rows, payGroups] = await Promise.all([
    getPayrollRunsForCurrentOrg(),
    getPayGroupsForCurrentOrg(),
  ])
  const activePayGroups = payGroups.filter((g) => g.active === true)
  return <PayrollRunsTable data={rows} payGroups={activePayGroups} />
}
