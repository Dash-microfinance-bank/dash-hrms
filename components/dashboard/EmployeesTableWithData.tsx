import { getEmployeesForCurrentOrg, getManagerStatsForSelection } from '@/lib/data/employees'
import { getDepartmentsForCurrentOrg } from '@/lib/data/departments'
import { getJobRolesTableData } from '@/lib/data/job-roles'
import { EmployeesTable } from '@/components/dashboard/EmployeesTable'

export async function EmployeesTableWithData() {
  const [employees, departments, { jobRoles }, managerStats] = await Promise.all([
    getEmployeesForCurrentOrg(),
    getDepartmentsForCurrentOrg(),
    getJobRolesTableData(),
    getManagerStatsForSelection(), // For create mode, no employeeId
  ])
  return (
    <EmployeesTable
      employees={employees}
      departments={departments}
      jobRoles={jobRoles}
      managerStats={managerStats}
    />
  )
}
