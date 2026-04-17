'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ChangeEvent } from '@/app/api/employees/[id]/360/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type ChangeEventSourceTable = 'employees' | 'employee_biodata'

// Tables that use employee_id as FK (not id) for their lookup
const EMPLOYEE_ID_KEYED = new Set([
  'employee_biodata',
  'employee_address',
  'employee_bank_details',
])

// Cards that write to employee_biodata
const BIODATA_CARD_NAMES = new Set(['identity', 'family', 'health', 'origin'])

// ─── Card definitions ─────────────────────────────────────────────────────────

type CardDef = { table: string; fields: string[] }

const CARD_FIELDS: Record<string, CardDef> = {
  identity: {
    table: 'employee_biodata',
    fields: ['title', 'firstname', 'lastname', 'othernames', 'gender', 'date_of_birth'],
  },
  family: {
    table: 'employee_biodata',
    fields: [
      'marital_status',
      'mothers_maiden_name',
      'spouse',
      'spouse_phone',
      'number_of_kids',
      'ethnic_group',
      'religion',
    ],
  },
  health: {
    table: 'employee_biodata',
    fields: ['blood_group', 'genotype', 'allergies', 'medical_history'],
  },
  origin: {
    table: 'employee_biodata',
    fields: ['place_of_birth', 'lga', 'state', 'country'],
  },
  address_card: {
    table: 'employee_address',
    fields: ['residential_address', 'nearest_bus_stop', 'nearest_landmark', 'city', 'state', 'country'],
  },
  bank_details_card: {
    table: 'employee_bank_details',
    fields: ['bank_name', 'account_name', 'account_number', 'account_type', 'bvn', 'nin', 'pfa', 'rsa_pin', 'tax_id', 'nhf_id'],
  },
  // manager_id intentionally excluded — handled via assignLineManager
  role: {
    table: 'employees',
    fields: ['department_id', 'job_role_id', 'report_location'],
  },
  contract: {
    table: 'employees',
    fields: [
      'staff_id',
      'contract_type',
      'employment_status',
      'start_date',
      'end_date',
      'active',
    ],
  },
}

// Fields in the contact card that live in the employees table
const CONTACT_EMPLOYEES_FIELDS = ['email', 'phone']
// Fields in the contact card that live in employee_biodata
const CONTACT_BIODATA_FIELDS = ['alternate_phone', 'alternate_email']

// Multi-row tables
export type MultiRowTable =
  | 'employee_dependants'
  | 'employee_experience'
  | 'employee_education'
  | 'employee_training'
  | 'employee_family'
  | 'employee_next_of_kin'

const MULTI_ROW_TABLES = new Set<string>([
  'employee_dependants',
  'employee_experience',
  'employee_education',
  'employee_training',
  'employee_family',
  'employee_next_of_kin',
])

// ─── Return types ─────────────────────────────────────────────────────────────

export type UpdateCardPayload = Record<string, unknown>

export type UpdateCardResult =
  | { success: true; updatedFields: UpdateCardPayload; newEvents: ChangeEvent[] }
  | { success: false; error: string }

export type MultiRowResult =
  | { success: true; record: Record<string, unknown> }
  | { success: false; error: string }

export type DeleteResult =
  | { success: true }
  | { success: false; error: string }

// ─── Context helper ───────────────────────────────────────────────────────────

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' } as const

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) return { error: 'Organization not found' } as const

  return { supabase, user, orgId: profile.organization_id as string }
}

// ─── Diff helper ─────────────────────────────────────────────────────────────

function diff(
  current: Record<string, unknown>,
  incoming: UpdateCardPayload,
  fields: string[]
): Array<{ field: string; oldVal: unknown; newVal: unknown }> {
  const changes: Array<{ field: string; oldVal: unknown; newVal: unknown }> = []
  for (const field of fields) {
    if (!(field in incoming)) continue
    const normOld = (current[field] ?? null) === '' ? null : (current[field] ?? null)
    const normNew = (incoming[field] ?? null) === '' ? null : (incoming[field] ?? null)
    if (String(normOld) !== String(normNew)) {
      changes.push({ field, oldVal: normOld, newVal: normNew })
    }
  }
  return changes
}

// ─── Insert change events (only for audited tables) ───────────────────────────

async function insertChangeEvents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  employeeId: string,
  userId: string,
  sourceTable: ChangeEventSourceTable,
  changes: Array<{ field: string; oldVal: unknown; newVal: unknown }>
): Promise<ChangeEvent[]> {
  if (changes.length === 0) return []

  const { data, error } = await supabase
    .from('employee_change_events')
    .insert(
      changes.map((c) => ({
        organization_id: orgId,
        employee_id: employeeId,
        source_table: sourceTable,
        field: c.field,
        old_value: c.oldVal ?? null,
        new_value: c.newVal ?? null,
        requested_by: userId,
        status: 'applied' as const,
      }))
    )
    .select('id, source_table, field, old_value, new_value, requested_by, status, reason, created_at')

  if (error) {
    console.error('[change-events] insert failed:', error.message)
    return []
  }

  return (data ?? []).map((e: Record<string, unknown>) => ({
    id: e.id as string,
    source_table: e.source_table as 'employees' | 'employee_biodata',
    field: e.field as string,
    old_value: e.old_value,
    new_value: e.new_value,
    requested_by: e.requested_by as string,
    requester_name: null,
    status: e.status as 'applied' | 'pending_approval' | 'rejected',
    reason: (e.reason ?? null) as string | null,
    created_at: e.created_at as string,
  }))
}

// ─── Circular-report guard ────────────────────────────────────────────────────

/**
 * Returns true if assigning `candidateManagerId` as manager of `employeeId`
 * would create a cycle (A → B → C → A).
 *
 * Walks UP the existing manager chain from `candidateManagerId`. If we
 * encounter `employeeId` before reaching a root, a cycle would be created.
 */
function wouldCreateCycle(
  employeeId: string,
  candidateManagerId: string,
  allEmployees: Array<{ id: string; manager_id: string | null }>
): boolean {
  const visited = new Set<string>()
  let current: string | null = candidateManagerId

  while (current !== null) {
    if (current === employeeId) return true
    if (visited.has(current)) break // guard against existing cycles in data
    visited.add(current)
    const emp = allEmployees.find((e) => e.id === current)
    current = emp?.manager_id ?? null
  }

  return false
}

// ─── assignLineManager ────────────────────────────────────────────────────────

/**
 * Assign or clear a direct line manager for an employee.
 *
 * Enforces:
 *   - Multi-tenancy: both employee and manager must belong to the caller's org.
 *   - Self-reporting: an employee cannot be their own manager.
 *   - Circular reporting: A → B → C → A is rejected before any DB write.
 *
 * History rules (employee_reporting_lines):
 *   - No prior active row → insert active row (effective_to = NULL).
 *   - Existing active row → close it (effective_to = now()), insert new active row.
 *
 * Role sync (user_roles):
 *   - Old manager with zero remaining direct reports → remove 'manager' role.
 *   - New manager without 'manager' role → add it.
 */
export async function assignLineManager(
  employeeId: string,
  newManagerId: string | null
): Promise<UpdateCardResult> {
  const ctx = await getContext()
  if ('error' in ctx) return { success: false, error: ctx.error as string }
  const { supabase, user, orgId } = ctx

  // ── Verify employee belongs to org ──────────────────────────────────────────
  const { data: empRow } = await supabase
    .from('employees')
    .select('id, manager_id')
    .eq('id', employeeId)
    .eq('organization_id', orgId)
    .single()

  if (!empRow) return { success: false, error: 'Employee not found' }

  const oldManagerId = (empRow.manager_id as string | null) ?? null

  // ── No-op guard ──────────────────────────────────────────────────────────────
  if (newManagerId === oldManagerId) {
    return { success: true, updatedFields: {}, newEvents: [] }
  }

  // ── Validate new manager ─────────────────────────────────────────────────────
  if (newManagerId) {
    // Must belong to same org
    const { data: mgrRow } = await supabase
      .from('employees')
      .select('id, active, auth_id')
      .eq('id', newManagerId)
      .eq('organization_id', orgId)
      .single()

    if (!mgrRow) {
      return {
        success: false,
        error: 'The selected line manager does not exist in your organisation.',
      }
    }
    if ((mgrRow as { active: boolean }).active !== true) {
      return { success: false, error: 'Line manager must be an active employee.' }
    }
    if (!(mgrRow as { auth_id: string | null }).auth_id) {
      return { success: false, error: 'Line manager must have an active login account.' }
    }

    // Self-reporting check
    if (newManagerId === employeeId) {
      return {
        success: false,
        error: 'An employee cannot report to themselves.',
      }
    }

    // Circular-reporting check — fetch whole active-manager graph for the org
    const { data: allEmp } = await supabase
      .from('employees')
      .select('id, manager_id')
      .eq('organization_id', orgId)
      .eq('active', true)

    const graph = (allEmp ?? []) as Array<{ id: string; manager_id: string | null }>
    if (wouldCreateCycle(employeeId, newManagerId, graph)) {
      return {
        success: false,
        error:
          'This assignment would create a circular reporting chain (e.g. A → B → C → A). Please choose a different manager.',
      }
    }
  }

  // ── Close existing active reporting-line row (if any) ────────────────────────
  const { data: activeRow } = await supabase
    .from('employee_reporting_lines')
    .select('id')
    .eq('employee_id', employeeId)
    .is('effective_to', null)
    .maybeSingle()

  if (activeRow) {
    const { error: closeErr } = await supabase
      .from('employee_reporting_lines')
      .update({ effective_to: new Date().toISOString() })
      .eq('id', (activeRow as { id: string }).id)
      .eq('organization_id', orgId)

    if (closeErr) {
      return { success: false, error: `Failed to close reporting line: ${closeErr.message}` }
    }
  }

  // ── Insert new active reporting-line row (if manager is being set) ───────────
  if (newManagerId) {
    const { error: insertErr } = await supabase.from('employee_reporting_lines').insert({
      organization_id: orgId,
      employee_id: employeeId,
      manager_id: newManagerId,
      effective_from: new Date().toISOString(),
      effective_to: null,
    })

    if (insertErr) {
      return { success: false, error: `Failed to create reporting line: ${insertErr.message}` }
    }
  }

  // ── Sync denormalised employees.manager_id ───────────────────────────────────
  const { error: syncErr } = await supabase
    .from('employees')
    .update({ manager_id: newManagerId })
    .eq('id', employeeId)
    .eq('organization_id', orgId)

  if (syncErr) {
    return { success: false, error: `Failed to sync manager: ${syncErr.message}` }
  }

  // ── Emit change event ────────────────────────────────────────────────────────
  const newEvents = await insertChangeEvents(supabase, orgId, employeeId, user.id, 'employees', [
    { field: 'manager_id', oldVal: oldManagerId, newVal: newManagerId },
  ])

  // ── Role sync ────────────────────────────────────────────────────────────────
  // Remove 'manager' role from old manager if they now have zero direct reports
  if (oldManagerId) {
    const { count: remaining } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('manager_id', oldManagerId)
      .eq('active', true)

    if ((remaining ?? 0) === 0) {
      // Fetch the auth_id of the old manager to look up their user_roles entry
      const { data: oldMgrEmp } = await supabase
        .from('employees')
        .select('auth_id')
        .eq('id', oldManagerId)
        .single()

      const oldMgrAuthId = (oldMgrEmp as { auth_id: string | null } | null)?.auth_id
      if (oldMgrAuthId) {
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', oldMgrAuthId)
          .eq('role', 'manager')
          .eq('organization_id', orgId)
      }
    }
  }

  // Add 'manager' role to new manager if they don't already have it
  if (newManagerId) {
    const { data: newMgrEmp } = await supabase
      .from('employees')
      .select('auth_id')
      .eq('id', newManagerId)
      .single()

    const newMgrAuthId = (newMgrEmp as { auth_id: string | null } | null)?.auth_id
    if (newMgrAuthId) {
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('user_id', newMgrAuthId)
        .eq('role', 'manager')
        .eq('organization_id', orgId)
        .maybeSingle()

      if (!existingRole) {
        await supabase.from('user_roles').insert({
          user_id: newMgrAuthId,
          role: 'manager',
          organization_id: orgId,
        })
      }
    }
  }

  revalidatePath('/dashboard/admin/employees')
  return { success: true, updatedFields: { manager_id: newManagerId }, newEvents }
}

// ─── updateEmployeeCard ───────────────────────────────────────────────────────

export async function updateEmployeeCard(
  employeeId: string,
  card: string,
  payload: UpdateCardPayload
): Promise<UpdateCardResult> {
  const ctx = await getContext()
  if ('error' in ctx) return { success: false, error: ctx.error as string }

  const { supabase, user, orgId } = ctx

  const { data: empCheck } = await supabase
    .from('employees')
    .select('id')
    .eq('id', employeeId)
    .eq('organization_id', orgId)
    .single()
  if (!empCheck) return { success: false, error: 'Employee not found' }

  const allNewEvents: ChangeEvent[] = []
  const mergedUpdated: UpdateCardPayload = {}

  // ── Contact card (spans employees + employee_biodata) ────────────────────────
  if (card === 'contact') {
    // employees side
    const empPayload: Record<string, unknown> = {}
    for (const f of CONTACT_EMPLOYEES_FIELDS) if (f in payload) empPayload[f] = payload[f]

    if (Object.keys(empPayload).length > 0) {
      const { data: cur } = await supabase.from('employees').select(CONTACT_EMPLOYEES_FIELDS.join(', ')).eq('id', employeeId).single()
      const curRec = (cur ?? {}) as Record<string, unknown>
      const empChanges = diff(curRec, empPayload, CONTACT_EMPLOYEES_FIELDS)
      if (empChanges.length > 0) {
        const upd: Record<string, unknown> = {}
        for (const c of empChanges) upd[c.field] = c.newVal
        const { error } = await supabase.from('employees').update(upd).eq('id', employeeId).eq('organization_id', orgId)
        if (error) return { success: false, error: error.message }
        const evts = await insertChangeEvents(supabase, orgId, employeeId, user.id, 'employees', empChanges)
        allNewEvents.push(...evts)
        Object.assign(mergedUpdated, upd)
      }
    }

    // employee_biodata side
    const bioPayload: Record<string, unknown> = {}
    for (const f of CONTACT_BIODATA_FIELDS) if (f in payload) bioPayload[f] = payload[f]

    if (Object.keys(bioPayload).length > 0) {
      const { data: cur } = await supabase.from('employee_biodata').select(CONTACT_BIODATA_FIELDS.join(', ')).eq('employee_id', employeeId).single()
      const curRec = (cur ?? {}) as Record<string, unknown>
      const bioChanges = diff(curRec, bioPayload, CONTACT_BIODATA_FIELDS)
      if (bioChanges.length > 0) {
        const upd: Record<string, unknown> = {}
        for (const c of bioChanges) upd[c.field] = c.newVal
        const { error } = await supabase.from('employee_biodata').update(upd).eq('employee_id', employeeId).eq('organization_id', orgId)
        if (error) return { success: false, error: error.message }
        const evts = await insertChangeEvents(supabase, orgId, employeeId, user.id, 'employee_biodata', bioChanges)
        allNewEvents.push(...evts)
        Object.assign(mergedUpdated, upd)
      }
    }

    revalidatePath('/dashboard/admin/employees')
    return { success: true, updatedFields: mergedUpdated, newEvents: allNewEvents }
  }

  // ── Role card — handle manager_id via assignLineManager, rest direct ──────────
  if (card === 'role') {
    // Delegate manager_id through the full history + validation flow
    if ('manager_id' in payload) {
      const incomingManagerId = (payload.manager_id as string | null) || null
      const result = await assignLineManager(employeeId, incomingManagerId)
      if (!result.success) return result
      allNewEvents.push(...result.newEvents)
      if (result.updatedFields.manager_id !== undefined) {
        mergedUpdated.manager_id = result.updatedFields.manager_id
      }
    }

    // Handle the remaining role fields (department_id, job_role_id, report_location) directly
    const roleDef = CARD_FIELDS['role']
    const rolePayload: Record<string, unknown> = {}
    for (const f of roleDef.fields) if (f in payload) rolePayload[f] = payload[f]

    if (Object.keys(rolePayload).length > 0) {
      const { data: cur } = await supabase.from('employees').select(roleDef.fields.join(', ')).eq('id', employeeId).single()
      const curRec = (cur ?? {}) as Record<string, unknown>
      const changes = diff(curRec, rolePayload, roleDef.fields)
      if (changes.length > 0) {
        const upd: Record<string, unknown> = {}
        for (const c of changes) upd[c.field] = c.newVal
        const { error } = await supabase.from('employees').update(upd).eq('id', employeeId).eq('organization_id', orgId)
        if (error) return { success: false, error: error.message }
        const evts = await insertChangeEvents(supabase, orgId, employeeId, user.id, 'employees', changes)
        allNewEvents.push(...evts)
        Object.assign(mergedUpdated, upd)
      }
    }

    revalidatePath('/dashboard/admin/employees')
    return { success: true, updatedFields: mergedUpdated, newEvents: allNewEvents }
  }

  // ── All other cards (single table) ──────────────────────────────────────────
  const cardDef = CARD_FIELDS[card]
  if (!cardDef) return { success: false, error: `Unknown card: ${card}` }

  const { table, fields } = cardDef
  const isEmployeeIdKeyed = EMPLOYEE_ID_KEYED.has(table)
  const isBiodataCard = BIODATA_CARD_NAMES.has(card)
  const isEmployeesTable = table === 'employees'

  // Fetch current values
  let currentRec: Record<string, unknown> = {}
  const selectCols = fields.join(', ')

  if (isEmployeeIdKeyed) {
    const { data } = await supabase.from(table).select(selectCols).eq('employee_id', employeeId).maybeSingle()
    currentRec = (data ?? {}) as Record<string, unknown>
  } else {
    const { data } = await supabase.from(table).select(selectCols).eq('id', employeeId).single()
    currentRec = (data ?? {}) as Record<string, unknown>
  }

  const changes = diff(currentRec, payload, fields)
  if (changes.length === 0) return { success: true, updatedFields: {}, newEvents: [] }

  const updateObj: Record<string, unknown> = {}
  for (const c of changes) updateObj[c.field] = c.newVal

  if (isEmployeesTable) {
    // Direct update by employee id
    const { error } = await supabase.from(table).update(updateObj).eq('id', employeeId).eq('organization_id', orgId)
    if (error) return { success: false, error: error.message }
  } else if (isEmployeeIdKeyed) {
    // Upsert using employee_id
    const { error } = await supabase
      .from(table)
      .upsert({ ...updateObj, employee_id: employeeId, organization_id: orgId }, { onConflict: 'employee_id' })
    if (error) return { success: false, error: error.message }
  }

  // Record change events for audited tables only
  if (isEmployeesTable) {
    const evts = await insertChangeEvents(supabase, orgId, employeeId, user.id, 'employees', changes)
    allNewEvents.push(...evts)
  } else if (isBiodataCard) {
    const evts = await insertChangeEvents(supabase, orgId, employeeId, user.id, 'employee_biodata', changes)
    allNewEvents.push(...evts)
  }

  revalidatePath('/dashboard/admin/employees')
  return { success: true, updatedFields: updateObj, newEvents: allNewEvents }
}

// ─── Multi-row CRUD ───────────────────────────────────────────────────────────

export async function addEmployeeRecord(
  employeeId: string,
  table: MultiRowTable,
  payload: Record<string, unknown>
): Promise<MultiRowResult> {
  if (!MULTI_ROW_TABLES.has(table)) return { success: false, error: 'Invalid table' }

  const ctx = await getContext()
  if ('error' in ctx) return { success: false, error: ctx.error as string }
  const { supabase, orgId } = ctx

  // Verify employee belongs to org
  const { data: emp } = await supabase.from('employees').select('id').eq('id', employeeId).eq('organization_id', orgId).single()
  if (!emp) return { success: false, error: 'Employee not found' }

  const { data, error } = await supabase
    .from(table)
    .insert({ ...payload, employee_id: employeeId, organization_id: orgId })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, record: data as Record<string, unknown> }
}

export async function updateEmployeeRecord(
  employeeId: string,
  table: MultiRowTable,
  recordId: string,
  payload: Record<string, unknown>
): Promise<MultiRowResult> {
  if (!MULTI_ROW_TABLES.has(table)) return { success: false, error: 'Invalid table' }

  const ctx = await getContext()
  if ('error' in ctx) return { success: false, error: ctx.error as string }
  const { supabase, orgId } = ctx

  const { data, error } = await supabase
    .from(table)
    .update(payload)
    .eq('id', recordId)
    .eq('employee_id', employeeId)
    .eq('organization_id', orgId)
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'Record not found' }
  return { success: true, record: data as Record<string, unknown> }
}

export async function deleteEmployeeRecord(
  employeeId: string,
  table: MultiRowTable,
  recordId: string
): Promise<DeleteResult> {
  if (!MULTI_ROW_TABLES.has(table)) return { success: false, error: 'Invalid table' }

  const ctx = await getContext()
  if ('error' in ctx) return { success: false, error: ctx.error as string }
  const { supabase, orgId } = ctx

  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', recordId)
    .eq('employee_id', employeeId)
    .eq('organization_id', orgId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
