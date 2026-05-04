'use server'

import { createClient } from '@/lib/supabase/server'

export type EmployeeLevelRow = {
  id: string
  organization_id: string
  name: string
  created_at: string
}

export async function getEmployeeLevelsForCurrentOrg(): Promise<EmployeeLevelRow[]> {
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
    .from('employee_levels')
    .select('id, organization_id, name, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.error('[EmployeeLevels] Failed to fetch levels:', error)
    return []
  }

  return data as EmployeeLevelRow[]
}
