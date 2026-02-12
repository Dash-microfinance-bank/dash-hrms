'use server'

import { createClient } from '@/lib/supabase/server'

export type GradeRow = {
  id: string
  organization_id: string
  name: string
  code: string | null
  level: number | null
  min_salary: string | null
  max_salary: string | null
  currency: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Fetch all grades for the current user's organization.
 * Returns an empty array if unauthenticated or org is missing.
 */
export async function getGradesForCurrentOrg(): Promise<GradeRow[]> {
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
    .from('grades')
    .select(
      'id, organization_id, name, code, level, min_salary, max_salary, currency, description, is_active, created_at, updated_at'
    )
    .eq('organization_id', orgId)
    .order('level', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.error('[Grades] Failed to fetch grades:', error)
    return []
  }

  // Supabase returns numeric columns as strings by default; keep as string here
  return data as GradeRow[]
}

