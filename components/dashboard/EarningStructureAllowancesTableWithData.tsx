import { EarningStructureAllowancesTable } from '@/components/dashboard/EarningStructureAllowancesTable'
import { getEarningStructureDetailsForCurrentOrg } from '@/lib/data/earning-structure-detail'

type Props = {
  structureId: string
}

export async function EarningStructureAllowancesTableWithData({ structureId }: Props) {
  const payload = await getEarningStructureDetailsForCurrentOrg(structureId)
  return (
    <EarningStructureAllowancesTable
      structureId={payload?.structure_id ?? structureId}
      rows={payload?.allowances ?? []}
      allowanceOptions={payload?.attachable_allowances ?? []}
    />
  )
}
