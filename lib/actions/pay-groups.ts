'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { PayDayType, PayFrequency } from '@/lib/data/pay-groups'

const ADMIN_ROLES = ['super_admin', 'hr', 'finance'] as const
const PAY_GROUPS_PATH = '/dashboard/admin/payroll/pay-groups'

export type PayGroupActionResult = { success: true } | { success: false; error: string }

export type UpsertPayGroupInput = {
  name: string
  pay_frequency: PayFrequency
  pay_day_type: PayDayType
  pay_day: number | null
  anchor_date: string | null
  currency: 'NGN'
  description: string | null
  auto_generate_payroll: boolean
}

async function getAdminContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' } as const

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) return { error: 'Organization not found' } as const

  const orgId = profile.organization_id
  const { data: rolesData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)

  const roles = (rolesData ?? []).map((r) => r.role as string)
  const hasAdminRole = roles.some((r) => ADMIN_ROLES.includes(r as (typeof ADMIN_ROLES)[number]))
  if (!hasAdminRole) return { error: 'You do not have permission to manage pay groups' } as const

  return { supabase, orgId } as { supabase: typeof supabase; orgId: string }
}

function normalizeInput(input: UpsertPayGroupInput): UpsertPayGroupInput {
  return {
    ...input,
    name: input.name.trim(),
    description: (input.description ?? '').trim() || null,
    currency: 'NGN',
    auto_generate_payroll: false, // currently fixed per business rule
  }
}

function utcWeekdayMon1Sun7(dateLike: string): number {
  const date = new Date(`${dateLike}T00:00:00.000Z`)
  const day = date.getUTCDay() // sun 0 .. sat 6
  return day === 0 ? 7 : day
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function validatePayGroupInput(input: UpsertPayGroupInput): string | null {
  if (!input.name) return 'Pay group name is required'

  if (!['DAILY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY'].includes(input.pay_frequency)) {
    return 'Invalid pay frequency'
  }

  if (!['FIXED_DAY', 'LAST_WORKING_DAY'].includes(input.pay_day_type)) {
    return 'Invalid payment schedule'
  }

  if (input.pay_frequency === 'MONTHLY' && input.pay_day_type === 'FIXED_DAY') {
    if (input.pay_day == null || input.pay_day < 1 || input.pay_day > 31) {
      return 'Pay day must be between 1 and 31 for monthly fixed day'
    }
  }

  if (input.pay_frequency === 'WEEKLY' || input.pay_frequency === 'BI_WEEKLY') {
    if (input.pay_day == null || input.pay_day < 1 || input.pay_day > 7) {
      return 'Select a valid day of the week'
    }
  }

  if (input.pay_frequency === 'BI_WEEKLY') {
    if (!input.anchor_date) return 'Start date is required for bi-weekly frequency'
    if (input.anchor_date < todayIso()) return 'Start date cannot be in the past'
    if (input.pay_day == null) return 'Select a day of the week'
    if (utcWeekdayMon1Sun7(input.anchor_date) !== input.pay_day) {
      return 'Start date must match the selected day of the week'
    }
  }

  if (input.currency !== 'NGN') return 'Only NGN is supported'
  return null
}

function rowForPersistence(input: UpsertPayGroupInput) {
  const isWeeklyCycle = input.pay_frequency === 'WEEKLY' || input.pay_frequency === 'BI_WEEKLY'
  const isMonthlyFixed = input.pay_frequency === 'MONTHLY' && input.pay_day_type === 'FIXED_DAY'

  return {
    name: input.name,
    pay_frequency: input.pay_frequency,
    pay_day_type: input.pay_day_type,
    pay_day: isWeeklyCycle || isMonthlyFixed ? input.pay_day : null,
    anchor_date: input.pay_frequency === 'BI_WEEKLY' ? input.anchor_date : null,
    currency: 'NGN',
    description: input.description,
    auto_generate_payroll: false,
  }
}

async function assertPayGroupOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  id: string
): Promise<{ ok: true } | { error: string }> {
  const { data, error } = await supabase
    .from('pay_groups')
    .select('id, organization_id')
    .eq('id', id)
    .single()
  if (error || !data) return { error: 'Pay group not found' }
  if (data.organization_id !== orgId) return { error: 'Cannot modify this pay group' }
  return { ok: true }
}

export async function createPayGroup(input: UpsertPayGroupInput): Promise<PayGroupActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const normalized = normalizeInput(input)
  const validationError = validatePayGroupInput(normalized)
  if (validationError) return { success: false, error: validationError }

  const { supabase, orgId } = ctx
  const { error } = await supabase.from('pay_groups').insert({
    organization_id: orgId,
    ...rowForPersistence(normalized),
    active: true,
  })
  if (error) return { success: false, error: error.message ?? 'Failed to create pay group' }

  revalidatePath(PAY_GROUPS_PATH)
  return { success: true }
}

export async function updatePayGroup(
  id: string,
  input: UpsertPayGroupInput
): Promise<PayGroupActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const normalized = normalizeInput(input)
  const validationError = validatePayGroupInput(normalized)
  if (validationError) return { success: false, error: validationError }

  const { supabase, orgId } = ctx
  const ownership = await assertPayGroupOwnership(supabase, orgId, id)
  if ('error' in ownership) return { success: false, error: ownership.error }

  const { error } = await supabase
    .from('pay_groups')
    .update(rowForPersistence(normalized))
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) return { success: false, error: error.message ?? 'Failed to update pay group' }

  revalidatePath(PAY_GROUPS_PATH)
  return { success: true }
}

export async function disablePayGroup(id: string): Promise<PayGroupActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }
  const { supabase, orgId } = ctx

  const ownership = await assertPayGroupOwnership(supabase, orgId, id)
  if ('error' in ownership) return { success: false, error: ownership.error }

  const { error } = await supabase
    .from('pay_groups')
    .update({ active: false })
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) return { success: false, error: error.message ?? 'Failed to disable pay group' }

  revalidatePath(PAY_GROUPS_PATH)
  return { success: true }
}

export async function activatePayGroup(id: string): Promise<PayGroupActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }
  const { supabase, orgId } = ctx

  const ownership = await assertPayGroupOwnership(supabase, orgId, id)
  if ('error' in ownership) return { success: false, error: ownership.error }

  const { error } = await supabase
    .from('pay_groups')
    .update({ active: true })
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) return { success: false, error: error.message ?? 'Failed to activate pay group' }

  revalidatePath(PAY_GROUPS_PATH)
  return { success: true }
}

export async function deletePayGroup(id: string): Promise<PayGroupActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }
  const { supabase, orgId } = ctx

  const ownership = await assertPayGroupOwnership(supabase, orgId, id)
  if ('error' in ownership) return { success: false, error: ownership.error }

  const { error: detachError } = await supabase
    .from('employees')
    .update({ pay_group: null })
    .eq('organization_id', orgId)
    .eq('pay_group', id)
  if (detachError) {
    return { success: false, error: detachError.message ?? 'Failed to detach employees from pay group' }
  }

  const { error } = await supabase
    .from('pay_groups')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) return { success: false, error: error.message ?? 'Failed to delete pay group' }

  revalidatePath(PAY_GROUPS_PATH)
  return { success: true }
}
