'use server'

import { createClient } from '@/lib/supabase/server'

export type FieldPermission = {
  field_key: string
  label: string
  can_read: boolean
  can_write: boolean
}

export type ProfileSchema = {
  [groupName: string]: FieldPermission[]
}

/**
 * Fetch employee profile schema for the current user's organization.
 * Returns schema grouped by group_name with read/write permissions.
 */
export async function getEmployeeProfileSchema(): Promise<ProfileSchema | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!myProfile?.organization_id) return null

  const orgId = myProfile.organization_id

  const { data, error } = await supabase.rpc('get_employee_profile_schema', {
    org_id: orgId,
  })

  if (error) {
    console.error('[Employee Permissions] Failed to fetch schema:', error)
    return null
  }

  return data as ProfileSchema
}
