import {
  getEmployeesForCurrentOrg,
  getManagerStatsForSelection,
} from '@/lib/data/employees'
import { getDepartmentsForCurrentOrg } from '@/lib/data/departments'
import { getJobRolesTableData } from '@/lib/data/job-roles'
import { getLocationsForCurrentOrg } from '@/lib/data/locations'
import { SingleEmployeeUploadForm } from '@/components/dashboard/SingleEmployeeUploadForm'
import { toLineManagerOptions } from '@/lib/utils/employee-format'

export async function SingleUploadWithData() {
  const [employees, departments, { jobRoles }, managerStats, locations] =
    await Promise.all([
      getEmployeesForCurrentOrg(),
      getDepartmentsForCurrentOrg(),
      getJobRolesTableData(),
      getManagerStatsForSelection(),
      getLocationsForCurrentOrg(),
    ])
  const lineManagerOptions = toLineManagerOptions(employees)
  return (
    <SingleEmployeeUploadForm
      departments={departments}
      jobRoles={jobRoles}
      lineManagerOptions={lineManagerOptions}
      managerStats={managerStats}
      locations={locations}
    />
  )
}
