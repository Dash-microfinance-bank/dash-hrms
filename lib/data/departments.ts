'use server'

import { createClient } from '@/lib/supabase/server'

export type DepartmentRow = {
  id: string
  organization_id: string
  name: string
  code: string | null
  description: string | null
  parent_department_id: string | null
  parent_department_name: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Fetch all departments for the current user's organization.
 * Returns an empty array if unauthenticated or org is missing.
 */
export async function getDepartmentsForCurrentOrg(): Promise<DepartmentRow[]> {
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

  const { data, error } = await supabase
    .from('departments')
    .select(
      'id, organization_id, name, code, description, parent_department_id, is_active, created_at, updated_at'
    )
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.error('[Departments] Failed to fetch departments:', error)
    return []
  }

  const rows = data as Array<{
    id: string
    organization_id: string
    name: string
    code: string | null
    description: string | null
    parent_department_id: string | null
    is_active: boolean
    created_at: string
    updated_at: string
  }>
  const byId = new Map(rows.map((r) => [r.id, r]))
  return rows.map((r) => ({
    ...r,
    parent_department_name: r.parent_department_id
      ? byId.get(r.parent_department_id)?.name ?? null
      : null,
  })) as DepartmentRow[]
}

