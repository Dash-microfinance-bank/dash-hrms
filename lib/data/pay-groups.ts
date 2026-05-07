'use server'

import { createClient } from '@/lib/supabase/server'

export type PayFrequency = 'DAILY' | 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY'
export type PayDayType = 'FIXED_DAY' | 'LAST_WORKING_DAY'

export type PayGroupRow = {
  id: string
  organization_id: string
  name: string | null
  pay_frequency: PayFrequency | null
  pay_day_type: PayDayType | null
  pay_day: number | null
  currency: string | null
  auto_generate_payroll: boolean | null
  active: boolean | null
  description: string | null
  anchor_date: string | null
  created_at: string
  employees_count: number
}

type BasePayGroupRow = Omit<PayGroupRow, 'employees_count'>

export async function getPayGroupsForCurrentOrg(): Promise<PayGroupRow[]> {
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

  const { data: groups, error: groupsError } = await supabase
    .from('pay_groups')
    .select(
      'id, organization_id, name, pay_frequency, pay_day_type, pay_day, currency, auto_generate_payroll, active, description, anchor_date, created_at'
    )
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (groupsError || !groups) {
    console.error('[PayGroups] Failed to fetch pay groups:', groupsError)
    return []
  }

  const groupIds = (groups as BasePayGroupRow[]).map((g) => g.id)
  let countsByGroup = new Map<string, number>()

  if (groupIds.length > 0) {
    const { data: linkedEmployees, error: employeesError } = await supabase
      .from('employees')
      .select('pay_group')
      .eq('organization_id', orgId)
      .eq('active', true)
      .not('auth_id', 'is', null)
      .in('pay_group', groupIds)

    if (employeesError) {
      console.error('[PayGroups] Failed to fetch employee counts:', employeesError)
    } else {
      countsByGroup = (linkedEmployees ?? []).reduce((acc, row) => {
        if (!row.pay_group) return acc
        acc.set(row.pay_group, (acc.get(row.pay_group) ?? 0) + 1)
        return acc
      }, new Map<string, number>())
    }
  }

  return (groups as BasePayGroupRow[]).map((row) => ({
    ...row,
    employees_count: countsByGroup.get(row.id) ?? 0,
  }))
}
