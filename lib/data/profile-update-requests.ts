'use server'

import { createClient } from '@/lib/supabase/server'

export type ProfileUpdateRequestListRow = {
  id: string
  employee_id: string
  organization_id: string
  status: 'pending' | 'approved' | 'rejected' | 'partially_approved'
  submitted_at: string | null
  created_at: string
  employee_email: string
  employee_firstname: string | null
  employee_lastname: string | null
  avatar_url: string | null
}

/**
 * Fetch profile update requests for the current user's organization.
 * Returns an empty array if unauthenticated or org is missing.
 */
export async function getProfileUpdateRequestsForCurrentOrg(): Promise<
  ProfileUpdateRequestListRow[]
> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data: myProfile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error(
      '[ProfileUpdateRequests] Failed to fetch current profile:',
      profileError
    )
  }

  if (!myProfile?.organization_id) return []

  const orgId = myProfile.organization_id

  // Base requests for org
  const {
    data: requestsData,
    error: requestsError,
  } = await supabase
    .from('profile_update_requests')
    .select(
      'id, employee_id, organization_id, status, submitted_at, created_at'
    )
    .eq('organization_id', orgId)
    .order('submitted_at', { ascending: false, nullsFirst: false })

  if (requestsError) {
    console.error(
      '[ProfileUpdateRequests] Failed to fetch requests:',
      requestsError
    )
    return []
  }

  const requests = (requestsData ?? []) as Array<{
    id: string
    employee_id: string
    organization_id: string
    status: ProfileUpdateRequestListRow['status']
    submitted_at: string | null
    created_at: string
  }>

  if (requests.length === 0) return []

  const employeeIds = Array.from(
    new Set(requests.map((r) => r.employee_id).filter(Boolean))
  )

  if (employeeIds.length === 0) {
    return requests.map((r) => ({
      ...r,
      employee_email: '',
      employee_firstname: null,
      employee_lastname: null,
      avatar_url: null,
    }))
  }

  // Employees (email, auth_id) in org for these requests
  const {
    data: employeesData,
    error: employeesError,
  } = await supabase
    .from('employees')
    .select('id, organization_id, email, auth_id')
    .eq('organization_id', orgId)
    .in('id', employeeIds)

  if (employeesError) {
    console.error(
      '[ProfileUpdateRequests] Failed to fetch employees:',
      employeesError
    )
  }

  const employees =
    (employeesData ?? []) as Array<{
      id: string
      organization_id: string
      email: string
      auth_id: string | null
    }>

  const employeeById = new Map<string, (typeof employees)[number]>()
  const authIds = new Set<string>()

  for (const emp of employees) {
    employeeById.set(emp.id, emp)
    if (emp.auth_id) authIds.add(emp.auth_id)
  }

  // Biodata for names
  const {
    data: biodataData,
    error: biodataError,
  } = await supabase
    .from('employee_biodata')
    .select('employee_id, firstname, lastname')
    .eq('organization_id', orgId)
    .in('employee_id', employeeIds)

  if (biodataError) {
    console.error(
      '[ProfileUpdateRequests] Failed to fetch employee biodata:',
      biodataError
    )
  }

  const biodataByEmployeeId = new Map<
    string,
    { firstname: string | null; lastname: string | null }
  >()
  for (const bio of (biodataData ?? []) as Array<{
    employee_id: string
    firstname: string | null
    lastname: string | null
  }>) {
    biodataByEmployeeId.set(bio.employee_id, {
      firstname: bio.firstname,
      lastname: bio.lastname,
    })
  }

  // Avatars from profiles via auth_id
  let avatarByEmployeeId = new Map<string, string | null>()
  if (authIds.size > 0) {
    const {
      data: profilesData,
      error: profilesError,
    } = await supabase
      .from('profiles')
      .select('id, avatar_url')
      .in('id', Array.from(authIds))

    if (profilesError) {
      console.error(
        '[ProfileUpdateRequests] Failed to fetch profile avatars:',
        profilesError
      )
    }

    const avatarByProfileId = new Map<string, string | null>()
    for (const p of (profilesData ?? []) as Array<{
      id: string
      avatar_url: string | null
    }>) {
      avatarByProfileId.set(p.id, p.avatar_url ?? null)
    }

    avatarByEmployeeId = new Map<string, string | null>()
    for (const emp of employees) {
      if (emp.auth_id) {
        avatarByEmployeeId.set(
          emp.id,
          avatarByProfileId.get(emp.auth_id) ?? null
        )
      }
    }
  }

  return requests.map((req) => {
    const emp = employeeById.get(req.employee_id)
    const bio = biodataByEmployeeId.get(req.employee_id)
    const avatarUrl = avatarByEmployeeId.get(req.employee_id) ?? null

    return {
      id: req.id,
      employee_id: req.employee_id,
      organization_id: req.organization_id,
      status: req.status,
      submitted_at: req.submitted_at,
      created_at: req.created_at,
      employee_email: emp?.email ?? '',
      employee_firstname: bio?.firstname ?? null,
      employee_lastname: bio?.lastname ?? null,
      avatar_url: avatarUrl,
    }
  })
}

