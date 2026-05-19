'use server'

import { createClient } from '@/lib/supabase/server'
import type { PayFrequency } from '@/lib/data/pay-groups'

export type PayrollRunStatus = 'DRAFT' | 'APPROVED' | 'LOCKED' | 'PAID'
export type PayrollRunType = 'REGULAR' | 'BACKDATED' | 'OFF_CYCLE' | 'ADJUSTMENT'

export type PayrollRunRow = {
  id: string
  pay_group_id: string
  pay_group_name: string | null
  pay_frequency: PayFrequency | null
  year: number
  month: number
  period: number | null
  total_employees: number
  /** Number of payroll_entries rows for this run. */
  entry_count: number
  status: PayrollRunStatus
  payroll_type: PayrollRunType
  created_at: string
}

type RawPayrollRunRow = {
  id: string
  pay_group_id: string
  year: number
  month: number
  period: number | null
  total_employees: number
  status: PayrollRunStatus
  payroll_type: PayrollRunType
  created_at: string
  pay_group: { name: string | null; pay_frequency: PayFrequency | null } | null
}

export async function getPayrollRunsForCurrentOrg(): Promise<PayrollRunRow[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) return []

  const orgId = profile.organization_id

  const { data, error } = await supabase
    .from('payroll_runs')
    .select(
      'id, pay_group_id, year, month, period, total_employees, status, payroll_type, created_at, pay_group:pay_groups(name, pay_frequency)'
    )
    .eq('organization_id', orgId)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.error('[PayrollRuns] Failed to fetch payroll runs:', error)
    return []
  }

  const runs = data as unknown as RawPayrollRunRow[]
  const runIds = runs.map((r) => r.id)

  const countByRun = new Map<string, number>()
  if (runIds.length > 0) {
    const { data: entryRows, error: entriesError } = await supabase
      .from('payroll_entries')
      .select('payroll_run_id')
      .in('payroll_run_id', runIds)

    if (entriesError) {
      console.error('[PayrollRuns] Failed to fetch entry counts:', entriesError)
    } else {
      for (const entry of entryRows ?? []) {
        const runId = entry.payroll_run_id as string
        countByRun.set(runId, (countByRun.get(runId) ?? 0) + 1)
      }
    }
  }

  return runs.map((row) => ({
    id: row.id,
    pay_group_id: row.pay_group_id,
    pay_group_name: row.pay_group?.name ?? null,
    pay_frequency: row.pay_group?.pay_frequency ?? null,
    year: row.year,
    month: row.month,
    period: row.period,
    total_employees: row.total_employees,
    entry_count: countByRun.get(row.id) ?? 0,
    status: row.status,
    payroll_type: row.payroll_type,
    created_at: row.created_at,
  }))
}
