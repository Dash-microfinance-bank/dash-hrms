import { getGradesForCurrentOrg } from '@/lib/data/grades'
import { GradesTable } from '@/components/dashboard/GradesTable'

export async function GradesTableWithData() {
  const grades = await getGradesForCurrentOrg()
  return <GradesTable data={grades} />
}

