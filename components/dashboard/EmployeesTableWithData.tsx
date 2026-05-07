import { getEmployeesForCurrentOrg, getManagerStatsForSelection } from '@/lib/data/employees'
import { getDepartmentsForCurrentOrg } from '@/lib/data/departments'
import { getJobRolesTableData } from '@/lib/data/job-roles'
import { getLocationsForCurrentOrg } from '@/lib/data/locations'
import { getPayGroupsForCurrentOrg } from '@/lib/data/pay-groups'
import { getEmployeeLevelsForCurrentOrg } from '@/lib/data/employee-levels'
import { getGradesForCurrentOrg } from '@/lib/data/grades'
import { EmployeesTable } from '@/components/dashboard/EmployeesTable'

export async function EmployeesTableWithData() {
  const [
    employees,
    departments,
    { jobRoles },
    managerStats,
    locations,
    payGroups,
    levels,
    grades,
  ] = await Promise.all([
    getEmployeesForCurrentOrg(),
    getDepartmentsForCurrentOrg(),
    getJobRolesTableData(),
    getManagerStatsForSelection(), // For create mode, no employeeId
    getLocationsForCurrentOrg(),
    getPayGroupsForCurrentOrg(),
    getEmployeeLevelsForCurrentOrg(),
    getGradesForCurrentOrg(),
  ])
  const activePayGroups = payGroups.filter((g) => g.active !== false)
  const activeGrades = grades.filter((g) => g.is_active)
  return (
    <EmployeesTable
      employees={employees}
      departments={departments}
      jobRoles={jobRoles}
      managerStats={managerStats}
      locations={locations}
      payGroups={activePayGroups}
      levels={levels}
      grades={activeGrades}
    />
  )
}
