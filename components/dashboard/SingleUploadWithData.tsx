import {
  getEmployeesForCurrentOrg,
  getManagerStatsForSelection,
} from '@/lib/data/employees'
import { getDepartmentsForCurrentOrg } from '@/lib/data/departments'
import { getJobRolesTableData } from '@/lib/data/job-roles'
import { getLocationsForCurrentOrg } from '@/lib/data/locations'
import { getPayGroupsForCurrentOrg } from '@/lib/data/pay-groups'
import { getEmployeeLevelsForCurrentOrg } from '@/lib/data/employee-levels'
import { getGradesForCurrentOrg } from '@/lib/data/grades'
import { SingleEmployeeUploadForm } from '@/components/dashboard/SingleEmployeeUploadForm'
import { toLineManagerOptions } from '@/lib/utils/employee-format'

export async function SingleUploadWithData() {
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
    getManagerStatsForSelection(),
    getLocationsForCurrentOrg(),
    getPayGroupsForCurrentOrg(),
    getEmployeeLevelsForCurrentOrg(),
    getGradesForCurrentOrg(),
  ])
  const lineManagerOptions = toLineManagerOptions(employees)
  const activePayGroups = payGroups.filter((g) => g.active !== false)
  const activeGrades = grades.filter((g) => g.is_active)
  return (
    <SingleEmployeeUploadForm
      departments={departments}
      jobRoles={jobRoles}
      lineManagerOptions={lineManagerOptions}
      managerStats={managerStats}
      locations={locations}
      payGroups={activePayGroups}
      levels={levels}
      grades={activeGrades}
    />
  )
}
