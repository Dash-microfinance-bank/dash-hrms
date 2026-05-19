'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { PayFrequency } from '@/lib/data/pay-groups'
import {
  derivePeriodForPayrollRun,
  refineRunPayrollByFrequency,
  runPayrollFormFieldsSchema,
  type RunPayrollFormValues,
} from '@/lib/validations/run-payroll'

const ADMIN_ROLES = ['super_admin', 'hr', 'finance'] as const
const PAYROLL_PATH = '/dashboard/admin/payroll'

export type CreatePayrollRunResult =
  | { success: true; payrollRunId: string }
  | { success: false; error: string }

export async function getPayrollAdminContext() {
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
  if (!hasAdminRole) {
    return { error: 'You do not have permission to run payroll' } as const
  }

  return { supabase, orgId, userId: user.id } as {
    supabase: Awaited<ReturnType<typeof createClient>>
    orgId: string
    userId: string
  }
}

export async function createPayrollRun(raw: unknown): Promise<CreatePayrollRunResult> {
  const ctx = await getPayrollAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const parsed = runPayrollFormFieldsSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors
    const msg =
      Object.values(first).flat()[0] ??
      parsed.error.issues[0]?.message ??
      'Invalid form data'
    return { success: false, error: msg }
  }

  const values: RunPayrollFormValues = parsed.data

  const { supabase, orgId, userId } = ctx

  const { data: payGroup, error: pgError } = await supabase
    .from('pay_groups')
    .select('id, organization_id, pay_frequency, active')
    .eq('id', values.pay_group_id)
    .eq('organization_id', orgId)
    .single()

  if (pgError || !payGroup) {
    return { success: false, error: 'Pay group not found' }
  }

  if (payGroup.active === false) {
    return { success: false, error: 'This pay group is disabled' }
  }

  const frequency = payGroup.pay_frequency as PayFrequency | null
  if (frequency == null) {
    return { success: false, error: 'Pay group has no pay frequency configured' }
  }

  const freqIssues = refineRunPayrollByFrequency(values, frequency)
  if (freqIssues.length > 0) {
    return { success: false, error: freqIssues[0]?.message ?? 'Validation failed' }
  }

  const year = new Date().getFullYear()
  const period = derivePeriodForPayrollRun(frequency, values)

  let dupQuery = supabase
    .from('payroll_runs')
    .select('id')
    .eq('organization_id', orgId)
    .eq('pay_group_id', values.pay_group_id)
    .eq('year', year)
    .eq('month', values.month)
    .eq('payroll_type', 'REGULAR')

  dupQuery = period == null ? dupQuery.is('period', null) : dupQuery.eq('period', period)

  const { data: existing, error: dupError } = await dupQuery.maybeSingle()

  if (dupError) {
    console.error('[createPayrollRun] Duplicate check failed:', dupError)
    return { success: false, error: dupError.message ?? 'Could not verify existing runs' }
  }

  if (existing?.id) {
    return {
      success: false,
      error: 'A payroll run already exists for this pay group, month, and period.',
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('payroll_runs')
    .insert({
      organization_id: orgId,
      pay_group_id: values.pay_group_id,
      month: values.month,
      year,
      period,
      total_employees: 0,
      total_gross: 0,
      total_net: 0,
      payroll_type: 'REGULAR',
      status: 'DRAFT',
      initiated_by: userId,
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return {
        success: false,
        error: 'A payroll run already exists for this pay group, month, and period.',
      }
    }
    console.error('[createPayrollRun] Insert failed:', insertError)
    return { success: false, error: insertError.message ?? 'Failed to create payroll run' }
  }

  if (!inserted?.id) {
    return { success: false, error: 'Failed to create payroll run' }
  }

  revalidatePath(PAYROLL_PATH)
  return { success: true, payrollRunId: inserted.id }
}
