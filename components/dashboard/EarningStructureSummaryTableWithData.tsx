import { EarningStructureSummaryTable } from '@/components/dashboard/EarningStructureSummaryTable'
import { getEarningStructureSummaryForCurrentOrg } from '@/lib/data/earning-structure-summary'

export async function EarningStructureSummaryTableWithData() {
  const payload = await getEarningStructureSummaryForCurrentOrg()
  return <EarningStructureSummaryTable rows={payload.rows} levels={payload.levels} />
}
