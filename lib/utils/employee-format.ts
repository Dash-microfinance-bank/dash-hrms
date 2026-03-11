import type { EmployeeRow } from '@/lib/data/employees'
import type { LineManagerOption } from '@/components/dashboard/CreateEmployeeModal'

export function formatEmployeeName(emp: EmployeeRow): string {
  const parts: string[] = []
  if (emp.biodata_title) parts.push(emp.biodata_title)
  if (emp.biodata_firstname) parts.push(emp.biodata_firstname)
  if (emp.biodata_lastname) parts.push(emp.biodata_lastname)
  return parts.length > 0 ? parts.join(' ') : emp.email
}

export function toLineManagerOptions(employees: EmployeeRow[]): LineManagerOption[] {
  return employees
    .filter((emp) => emp.auth_id != null && emp.auth_id !== '')
    .map((emp) => {
    const name = formatEmployeeName(emp)
    const jobRoleDisplay =
      emp.job_role_title && emp.job_role_code?.trim()
        ? `${emp.job_role_title} (${emp.job_role_code.trim()})`
        : emp.job_role_title ?? '—'
    return {
      id: emp.auth_id ?? '',
      employeeId: emp.id,
      name,
      jobRoleDisplay,
      avatarUrl: emp.avatar_url ?? null,
    }
  })
}
