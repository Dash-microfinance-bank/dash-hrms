import { createClient } from '@/lib/supabase/server'

export type ProfileRow = {
  id: string
  organization_id: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
  roles: string[]
}

export type UsersWithCurrentUser = {
  users: ProfileRow[]
  currentUserId: string
}

/**
 * Fetches all profiles in the current user's organization with their roles,
 * and the current user's id (for edit-access rules).
 * Requires an authenticated user with a profile in the org.
 */
export async function getUsersWithRolesForCurrentOrg(): Promise<ProfileRow[]> {
  const result = await getUsersWithRolesAndCurrentUser()
  return result?.users ?? []
}

/**
 * Same as getUsersWithRolesForCurrentOrg but also returns currentUserId for use in Edit Access modal.
 */
export async function getUsersWithRolesAndCurrentUser(): Promise<UsersWithCurrentUser | null> {
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

  const [profilesRes, rolesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, organization_id, full_name, avatar_url, created_at, updated_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_roles')
      .select('user_id, role')
      .eq('organization_id', orgId),
  ])

  if (profilesRes.error || rolesRes.error) return null

  const rolesByUserId = new Map<string, string[]>()
  for (const r of rolesRes.data ?? []) {
    const list = rolesByUserId.get(r.user_id) ?? []
    list.push(r.role as string)
    rolesByUserId.set(r.user_id, list)
  }

  const users: ProfileRow[] = (profilesRes.data ?? []).map((p) => ({
    id: p.id,
    organization_id: p.organization_id,
    full_name: p.full_name ?? null,
    avatar_url: p.avatar_url ?? null,
    created_at: p.created_at,
    updated_at: p.updated_at,
    roles: rolesByUserId.get(p.id) ?? [],
  }))

  return { users, currentUserId: user.id }
}
