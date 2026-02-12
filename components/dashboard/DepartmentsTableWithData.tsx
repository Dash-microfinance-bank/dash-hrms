import { getDepartmentsForCurrentOrg } from '@/lib/data/departments'
import { DepartmentsTable } from '@/components/dashboard/DepartmentsTable'

export async function DepartmentsTableWithData() {
  const departments = await getDepartmentsForCurrentOrg()
  return <DepartmentsTable data={departments} />
}

