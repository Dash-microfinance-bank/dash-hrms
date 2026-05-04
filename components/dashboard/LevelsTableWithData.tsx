import { getEmployeeLevelsForCurrentOrg } from '@/lib/data/employee-levels'
import { LevelsTable } from '@/components/dashboard/LevelsTable'

export async function LevelsTableWithData() {
  const levels = await getEmployeeLevelsForCurrentOrg()
  return <LevelsTable data={levels} />
}
