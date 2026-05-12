import { PayGroupsTable } from '@/components/dashboard/PayGroupsTable'
import { getPayGroupsForCurrentOrg } from '@/lib/data/pay-groups'

export async function PayGroupsTableWithData() {
  const payGroups = await getPayGroupsForCurrentOrg()
  return <PayGroupsTable data={payGroups} />
}
