'use server'

import { createClient } from '@/lib/supabase/server'

export type DepartmentRow = {
  id: string
  organization_id: string
  name: string
  code: string | null
  description: string | null
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
      'id, organization_id, name, code, description, is_active, created_at, updated_at'
    )
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.error('[Departments] Failed to fetch departments:', error)
    return []
  }

  return data as DepartmentRow[]
}

