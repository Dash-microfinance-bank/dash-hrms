import { getJobRolesTableData } from '@/lib/data/job-roles'
import { JobRolesTable } from '@/components/dashboard/JobRolesTable'

export async function JobRolesTableWithData() {
  const { jobRoles, departments } = await getJobRolesTableData()
  return <JobRolesTable jobRoles={jobRoles} departments={departments} />
}

