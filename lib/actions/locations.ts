'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const ADMIN_ROLES = ['super_admin', 'hr', 'finance'] as const

export type LocationActionResult =
  | { success: true }
  | { success: false; error: string }

async function getAdminContext() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' } as const
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return { error: 'Organization not found' } as const
  }

  const orgId = profile.organization_id

  const { data: rolesData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)

  const roles = (rolesData ?? []).map((r) => r.role as string)
  const hasAdminRole = roles.some((r) => ADMIN_ROLES.includes(r as (typeof ADMIN_ROLES)[number]))

  if (!hasAdminRole) {
    return { error: 'You do not have permission to manage office locations' } as const
  }

  return { supabase, user, orgId } as {
    supabase: typeof supabase
    user: typeof user
    orgId: string
  }
}

type CreateLocationInput = {
  country: string
  state: string
  address: string
}

const LOCATIONS_PATH = '/dashboard/admin/locations'

export async function createLocation(
  input: CreateLocationInput
): Promise<LocationActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx

  const country = input.country?.trim() || null
  const state = input.state?.trim() || null
  const address = input.address?.trim() || null

  const { error } = await supabase.from('organization_location').insert({
    organization_id: orgId,
    country,
    state,
    address,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(LOCATIONS_PATH)
  return { success: true }
}

type UpdateLocationInput = {
  country?: string
  state?: string
  address?: string
}

export async function updateLocation(
  id: string,
  input: UpdateLocationInput
): Promise<LocationActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx

  const { data: existing, error: fetchError } = await supabase
    .from('organization_location')
    .select('id, organization_id')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Location not found' }
  }

  if (existing.organization_id !== orgId) {
    return { success: false, error: 'Cannot edit a location from another organization' }
  }

  const country = input.country !== undefined ? (input.country?.trim() || null) : undefined
  const state = input.state !== undefined ? (input.state?.trim() || null) : undefined
  const address = input.address !== undefined ? (input.address?.trim() || null) : undefined

  const updatePayload: Record<string, unknown> = {}
  if (country !== undefined) updatePayload.country = country
  if (state !== undefined) updatePayload.state = state
  if (address !== undefined) updatePayload.address = address

  const { error } = await supabase
    .from('organization_location')
    .update(updatePayload)
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(LOCATIONS_PATH)
  return { success: true }
}

export async function deleteLocation(id: string): Promise<LocationActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx

  const { error } = await supabase
    .from('organization_location')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(LOCATIONS_PATH)
  return { success: true }
}
