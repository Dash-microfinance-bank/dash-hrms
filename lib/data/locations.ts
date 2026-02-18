'use server'

import { createClient } from '@/lib/supabase/server'

export type LocationRow = {
  id: string
  organization_id: string
  country: string | null
  state: string | null
  address: string | null
  headquarter: boolean
  created_at: string
}

/**
 * Fetch all office locations for the current user's organization.
 * Returns an empty array if unauthenticated or org is missing.
 */
export async function getLocationsForCurrentOrg(): Promise<LocationRow[]> {
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
    .from('organization_location')
    .select('id, organization_id, country, state, address, headquarter, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Locations] Failed to fetch locations:', error)
    return []
  }

  return (data ?? []) as LocationRow[]
}
