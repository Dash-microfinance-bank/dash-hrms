'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const ADMIN_ROLES = ['super_admin', 'hr', 'finance'] as const

export type SalaryComponentActionResult =
  | { success: true }
  | { success: false; error: string }

type CreateAllowanceInput = {
  name: string
  calculation_type: 'FIXED' | 'PERCENTAGE'
  calculation_base: 'NONE' | 'BASIC' | 'GROSS'
  is_taxable: boolean
}

type UpdateAllowanceInput = {
  name: string
  calculation_type: 'FIXED' | 'PERCENTAGE'
  calculation_base: 'NONE' | 'BASIC' | 'GROSS'
  is_taxable: boolean
}

const ALLOWANCES_PATH = '/dashboard/admin/payroll/allowances'

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
    return { error: 'You do not have permission to manage salary components' } as const
  }

  return { supabase, orgId } as {
    supabase: typeof supabase
    orgId: string
  }
}

export async function createAllowance(
  input: CreateAllowanceInput
): Promise<SalaryComponentActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx
  const name = input.name.trim()

  if (!name) {
    return { success: false, error: 'Name is required' }
  }

  if (
    input.calculation_type === 'PERCENTAGE' &&
    !['BASIC', 'GROSS'].includes(input.calculation_base)
  ) {
    return { success: false, error: 'Based on must be base salary or gross salary' }
  }

  const calculationBase =
    input.calculation_type === 'PERCENTAGE' ? input.calculation_base : 'NONE'

  const { error } = await supabase.from('salary_components').insert({
    organization_id: orgId,
    name,
    code: null,
    type: 'ALLOWANCE',
    calculation_type: input.calculation_type,
    calculation_base: calculationBase,
    is_taxable: input.is_taxable,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(ALLOWANCES_PATH)
  return { success: true }
}

export async function updateAllowance(
  id: string,
  input: UpdateAllowanceInput
): Promise<SalaryComponentActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx
  const name = input.name.trim()

  if (!name) {
    return { success: false, error: 'Name is required' }
  }

  if (
    input.calculation_type === 'PERCENTAGE' &&
    !['BASIC', 'GROSS'].includes(input.calculation_base)
  ) {
    return { success: false, error: 'Based on must be base salary or gross salary' }
  }

  const calculationBase =
    input.calculation_type === 'PERCENTAGE' ? input.calculation_base : 'NONE'

  const { data: existing, error: fetchError } = await supabase
    .from('salary_components')
    .select('id, organization_id, type')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Allowance not found' }
  }

  if (existing.organization_id !== orgId || existing.type !== 'ALLOWANCE') {
    return { success: false, error: 'Cannot edit this allowance' }
  }

  const { error } = await supabase
    .from('salary_components')
    .update({
      name,
      calculation_type: input.calculation_type,
      calculation_base: calculationBase,
      is_taxable: input.is_taxable,
    })
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('type', 'ALLOWANCE')

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(ALLOWANCES_PATH)
  return { success: true }
}

export async function deleteAllowance(id: string): Promise<SalaryComponentActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx

  const { error } = await supabase
    .from('salary_components')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('type', 'ALLOWANCE')

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(ALLOWANCES_PATH)
  return { success: true }
}

export async function disableAllowance(id: string): Promise<SalaryComponentActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx

  const { error } = await supabase
    .from('salary_components')
    .update({
      is_active: false,
    })
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('type', 'ALLOWANCE')

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(ALLOWANCES_PATH)
  return { success: true }
}

export async function activateAllowance(id: string): Promise<SalaryComponentActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx

  const { error } = await supabase
    .from('salary_components')
    .update({
      is_active: true,
    })
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('type', 'ALLOWANCE')

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(ALLOWANCES_PATH)
  return { success: true }
}
