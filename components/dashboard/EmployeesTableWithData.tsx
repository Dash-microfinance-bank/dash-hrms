import { getEmployeesForCurrentOrg, getManagerStatsForSelection } from '@/lib/data/employees'
import { getDepartmentsForCurrentOrg } from '@/lib/data/departments'
import { getJobRolesTableData } from '@/lib/data/job-roles'
import { getLocationsForCurrentOrg } from '@/lib/data/locations'
import { EmployeesTable } from '@/components/dashboard/EmployeesTable'

export async function EmployeesTableWithData() {
  const [employees, departments, { jobRoles }, managerStats, locations] = await Promise.all([
    getEmployeesForCurrentOrg(),
    getDepartmentsForCurrentOrg(),
    getJobRolesTableData(),
    getManagerStatsForSelection(), // For create mode, no employeeId
    getLocationsForCurrentOrg(),
  ])
  return (
    <EmployeesTable
      employees={employees}
      departments={departments}
      jobRoles={jobRoles}
      managerStats={managerStats}
      locations={locations}
    />
  )
}
