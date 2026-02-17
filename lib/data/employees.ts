'use server'

import { createClient } from '@/lib/supabase/server'

export type EmployeeRow = {
  id: string
  organization_id: string
  staff_id: string
  email: string
  phone: string | null
  contract_type: 'permanent' | 'part_time' | 'fixed_term' | 'temporary' | 'intern' | 'contractor'
  start_date: string | null
  end_date: string | null
  employment_status: 'probation' | 'confirmed'
  active: boolean
  created_at: string
  department_id: string
  job_role_id: string
  manager_id: string | null
  department_name: string | null
  department_code: string | null
  job_role_title: string | null
  job_role_code: string | null
  biodata_title: string | null
  biodata_firstname: string | null
  biodata_lastname: string | null
  avatar_url: string | null
  profile_completion_pct: number
}

/**
 * Fetch all employees for the current user's organization.
 * Returns an empty array if unauthenticated or org is missing.
 */
export async function getEmployeesForCurrentOrg(): Promise<EmployeeRow[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!myProfile?.organization_id) return []

  const orgId = myProfile.organization_id

  const [
    { data: employeesData, error: employeesError },
    { data: departmentsData, error: departmentsError },
    { data: jobRolesData, error: jobRolesError },
    { data: biodataData, error: biodataError },
    { data: avatarData, error: avatarError },
    { data: completionData, error: completionError },
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('id, organization_id, staff_id, email, phone, contract_type, start_date, end_date, employment_status, active, created_at, department_id, job_role_id, manager_id')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('departments')
      .select('id, name, code')
      .eq('organization_id', orgId),
    supabase
      .from('job_roles')
      .select('id, title, code')
      .eq('organization_id', orgId),
    supabase
      .from('employee_biodata')
      .select('employee_id, title, firstname, lastname')
      .eq('organization_id', orgId),
    supabase.rpc('get_employee_avatars', { p_org_id: orgId }),
    supabase.rpc('get_employee_profile_completion', { p_org_id: orgId }),
  ])

  if (employeesError) {
    console.error('[Employees] Failed to fetch employees:', employeesError)
    return []
  }

  if (departmentsError) {
    console.error('[Employees] Failed to fetch departments:', departmentsError)
  }

  if (jobRolesError) {
    console.error('[Employees] Failed to fetch job roles:', jobRolesError)
  }

  if (biodataError) {
    console.error('[Employees] Failed to fetch biodata:', biodataError)
  }

  if (avatarError) {
    console.error('[Employees] Failed to fetch employee avatars:', avatarError)
  }

  if (completionError) {
    console.error('[Employees] Failed to fetch profile completion:', completionError)
  }

  const employees = employeesData ?? []
  const departments = (departmentsData ?? []) as Array<{ id: string; name: string; code: string | null }>
  const jobRoles = (jobRolesData ?? []) as Array<{ id: string; title: string; code: string | null }>
  const biodataRecords = (biodataData ?? []) as Array<{ employee_id: string; title: string | null; firstname: string | null; lastname: string | null }>
  const avatarRecords = (avatarData ?? []) as Array<{ employee_id: string; avatar_url: string | null }>
  const completionRecords = (completionData ?? []) as Array<{
    employee_id: string
    filled_count: number
    total_count: number
  }>

  // Create a map of employee_id -> avatar_url
  const avatarByEmployeeId = new Map<string, string | null>()
  for (const av of avatarRecords) {
    avatarByEmployeeId.set(av.employee_id, av.avatar_url)
  }

  const completionByEmployeeId = new Map<string, number>()
  for (const c of completionRecords) {
    const total = c.total_count && c.total_count > 0 ? c.total_count : 63
    completionByEmployeeId.set(
      c.employee_id,
      Math.round((c.filled_count / total) * 100)
    )
  }

  const departmentById = new Map<string, { name: string; code: string | null }>()
  for (const dept of departments) {
    departmentById.set(dept.id, { name: dept.name, code: dept.code })
  }

  const jobRoleById = new Map<string, { title: string; code: string | null }>()
  for (const jr of jobRoles) {
    jobRoleById.set(jr.id, { title: jr.title, code: jr.code })
  }

  const biodataByEmployeeId = new Map<string, { title: string | null; firstname: string | null; lastname: string | null }>()
  for (const bio of biodataRecords) {
    biodataByEmployeeId.set(bio.employee_id, {
      title: bio.title,
      firstname: bio.firstname,
      lastname: bio.lastname,
    })
  }

  return employees.map((emp: any) => {
    const dept = departmentById.get(emp.department_id)
    const jr = jobRoleById.get(emp.job_role_id)
    const bio = biodataByEmployeeId.get(emp.id)
    const avatarUrl = avatarByEmployeeId.get(emp.id) ?? null
    const profileCompletionPct = completionByEmployeeId.get(emp.id) ?? 0

    return {
      id: emp.id as string,
      organization_id: emp.organization_id as string,
      staff_id: emp.staff_id as string,
      email: emp.email as string,
      phone: (emp.phone ?? null) as string | null,
      contract_type: emp.contract_type as EmployeeRow['contract_type'],
      start_date: (emp.start_date ?? null) as string | null,
      end_date: (emp.end_date ?? null) as string | null,
      employment_status: emp.employment_status as EmployeeRow['employment_status'],
      active: emp.active as boolean,
      created_at: emp.created_at as string,
      department_id: emp.department_id as string,
      job_role_id: emp.job_role_id as string,
      manager_id: (emp.manager_id ?? null) as string | null,
      department_name: dept?.name ?? null,
      department_code: dept?.code ?? null,
      job_role_title: jr?.title ?? null,
      job_role_code: jr?.code ?? null,
      biodata_title: bio?.title ?? null,
      biodata_firstname: bio?.firstname ?? null,
      biodata_lastname: bio?.lastname ?? null,
      avatar_url: avatarUrl,
      profile_completion_pct: profileCompletionPct,
    }
  })
}

export type ManagerStats = {
  topManagers: Array<{ id: string; directReportsCount: number }>
  excludedIds: string[]
}

/**
 * Get manager statistics and excluded employee IDs for line manager selection.
 * For create mode: returns top 5 managers and empty excludedIds.
 * For edit mode (when employeeId is provided): excludes self and all subordinates.
 */
export async function getManagerStatsForSelection(
  employeeId?: string | null
): Promise<ManagerStats> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { topManagers: [], excludedIds: [] }
  }

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!myProfile?.organization_id) {
    return { topManagers: [], excludedIds: [] }
  }

  const orgId = myProfile.organization_id

  // Fetch all employees with their manager_id
  const { data: employeesData, error } = await supabase
    .from('employees')
    .select('id, manager_id')
    .eq('organization_id', orgId)
    .eq('active', true)

  if (error || !employeesData) {
    console.error('[ManagerStats] Failed to fetch employees:', error)
    return { topManagers: [], excludedIds: [] }
  }

  // Count direct reports for each manager
  const managerReportCounts = new Map<string, number>()
  for (const emp of employeesData) {
    if (emp.manager_id) {
      const count = managerReportCounts.get(emp.manager_id) || 0
      managerReportCounts.set(emp.manager_id, count + 1)
    }
  }

  // Get top 5 managers by direct report count
  const topManagers = Array.from(managerReportCounts.entries())
    .map(([id, directReportsCount]) => ({ id, directReportsCount }))
    .sort((a, b) => b.directReportsCount - a.directReportsCount)
    .slice(0, 5)

  // Build excluded IDs list
  const excludedIds: string[] = []

  if (employeeId) {
    // Exclude self
    excludedIds.push(employeeId)

    // Find all subordinates (direct and indirect)
    const subordinates = new Set<string>()
    const findSubordinates = (managerId: string) => {
      for (const emp of employeesData) {
        if (emp.manager_id === managerId && emp.id !== managerId) {
          subordinates.add(emp.id)
          findSubordinates(emp.id) // Recursive to find indirect subordinates
        }
      }
    }
    findSubordinates(employeeId)
    excludedIds.push(...Array.from(subordinates))
  }

  return { topManagers, excludedIds }
}
