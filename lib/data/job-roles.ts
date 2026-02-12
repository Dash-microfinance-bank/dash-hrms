'use server'

import { createClient } from '@/lib/supabase/server'
import type { DepartmentRow } from '@/lib/data/departments'

export type JobRoleRow = {
  id: string
  organization_id: string
  name: string
  code: string | null
  department_id: string
  created_at: string
  updated_at: string
  department_name: string | null
  department_code: string | null
}

export type JobRolesTableData = {
  jobRoles: JobRoleRow[]
  departments: DepartmentRow[]
}

/**
 * Fetch job roles and departments for the current user's organization.
 * Returns empty arrays if unauthenticated or org is missing.
 */
export async function getJobRolesTableData(): Promise<JobRolesTableData> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { jobRoles: [], departments: [] }
  }

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!myProfile?.organization_id) {
    return { jobRoles: [], departments: [] }
  }

  const orgId = myProfile.organization_id

  const [{ data: jobRolesData, error: jobRolesError }, { data: departmentsData, error: departmentsError }] =
    await Promise.all([
      supabase
        .from('job_roles')
        .select('id, organization_id, title, code, department_id, created_at, updated_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false }),
      supabase
        .from('departments')
        .select(
          'id, organization_id, name, code, description, is_active, created_at, updated_at'
        )
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false }),
    ])

  if (jobRolesError) {
    console.error('[JobRoles] Failed to fetch job roles:', jobRolesError)
  }

  if (departmentsError) {
    console.error('[JobRoles] Failed to fetch departments for job roles page:', departmentsError)
  }

  const departments = (departmentsData ?? []) as DepartmentRow[]
  const departmentById = new Map<string, DepartmentRow>()
  for (const dept of departments) {
    departmentById.set(dept.id, dept)
  }

  const jobRoles: JobRoleRow[] = (jobRolesData ?? []).map((jr: any) => {
    const dept = departmentById.get(jr.department_id as string)
    return {
      id: jr.id as string,
      organization_id: jr.organization_id as string,
      name: jr.title as string,
      code: (jr.code ?? null) as string | null,
      department_id: jr.department_id as string,
      created_at: jr.created_at as string,
      updated_at: jr.updated_at as string,
      department_name: dept?.name ?? null,
      department_code: dept?.code ?? null,
    }
  })

  return {
    jobRoles,
    departments,
  }
}

