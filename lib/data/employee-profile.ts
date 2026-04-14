'use server'

import { createClient } from '@/lib/supabase/server'

// ─── ESS context ──────────────────────────────────────────────────────────────

export type EssContext =
  | {
      supabase: Awaited<ReturnType<typeof createClient>>
      userId: string
      orgId: string
      employeeId: string
    }
  | { error: string }

export async function getEssContext(): Promise<EssContext> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) return { error: 'Organization not found' }

  const orgId = profile.organization_id as string

  const { data: employee } = await supabase
    .from('employees')
    .select('id')
    .eq('organization_id', orgId)
    .eq('auth_id', user.id)
    .single()

  if (!employee) return { error: 'Employee record not found' }

  return { supabase, userId: user.id, orgId, employeeId: (employee as { id: string }).id }
}

// ─── Flat profile keyed by field_key ─────────────────────────────────────────

export type FlatProfile = Record<string, unknown>

const SKIP_BASE: ReadonlySet<string> = new Set(['id', 'employee_id', 'organization_id'])

/**
 * Loads a flat profile map for the current ESS user.
 * Keys use the canonical field_key format: "table.column".
 * Only covers single-record tables supported by the request form.
 */
export async function getCurrentEmployeeProfileForEss(): Promise<FlatProfile | null> {
  const ctx = await getEssContext()
  if ('error' in ctx) return null

  const { supabase, employeeId, orgId } = ctx

  const [
    { data: emp },
    { data: biodata },
    { data: address },
    { data: bank },
    { data: nok },
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('email, phone')
      .eq('id', employeeId)
      .eq('organization_id', orgId)
      .single(),
    supabase
      .from('employee_biodata')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('organization_id', orgId)
      .maybeSingle(),
    supabase
      .from('employee_address')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('organization_id', orgId)
      .maybeSingle(),
    supabase
      .from('employee_bank_details')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('organization_id', orgId)
      .maybeSingle(),
    supabase
      .from('employee_next_of_kin')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('organization_id', orgId)
      .order('created_at')
      .limit(1)
      .maybeSingle(),
  ])

  const flat: FlatProfile = {}

  if (emp) {
    const e = emp as { email: string; phone: string | null }
    flat['employees.email'] = e.email
    flat['employees.phone'] = e.phone
  }

  const skipBiodata = new Set([...SKIP_BASE, 'created_at', 'updated_at'])
  if (biodata) {
    for (const [k, v] of Object.entries(biodata as Record<string, unknown>)) {
      if (!skipBiodata.has(k)) flat[`employee_biodata.${k}`] = v
    }
  }

  const skipAddress = new Set([...SKIP_BASE])
  if (address) {
    for (const [k, v] of Object.entries(address as Record<string, unknown>)) {
      if (!skipAddress.has(k)) flat[`employee_address.${k}`] = v
    }
  }

  const skipBank = new Set([...SKIP_BASE])
  if (bank) {
    for (const [k, v] of Object.entries(bank as Record<string, unknown>)) {
      if (!skipBank.has(k)) flat[`employee_bank_details.${k}`] = v
    }
  }

  // Exclude 'purpose' — it is an internal ops field, not user-editable
  const skipNok = new Set([...SKIP_BASE, 'created_at', 'purpose'])
  if (nok) {
    for (const [k, v] of Object.entries(nok as Record<string, unknown>)) {
      if (!skipNok.has(k)) flat[`employee_next_of_kin.${k}`] = v
    }
  }

  return flat
}

/**
 * Loads a flat profile map for a given employee (by id). Uses current user's org.
 * For use in admin/HR context when reviewing a profile update request.
 */
export async function getEmployeeProfileByEmployeeId(
  employeeId: string
): Promise<FlatProfile | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  const orgId = (profile as { organization_id: string } | null)?.organization_id
  if (!orgId) return null

  const [
    { data: emp },
    { data: biodata },
    { data: address },
    { data: bank },
    { data: nok },
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('email, phone')
      .eq('id', employeeId)
      .eq('organization_id', orgId)
      .single(),
    supabase
      .from('employee_biodata')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('organization_id', orgId)
      .maybeSingle(),
    supabase
      .from('employee_address')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('organization_id', orgId)
      .maybeSingle(),
    supabase
      .from('employee_bank_details')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('organization_id', orgId)
      .maybeSingle(),
    supabase
      .from('employee_next_of_kin')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('organization_id', orgId)
      .order('created_at')
      .limit(1)
      .maybeSingle(),
  ])

  const flat: FlatProfile = {}

  if (emp) {
    const e = emp as { email: string; phone: string | null }
    flat['employees.email'] = e.email
    flat['employees.phone'] = e.phone
  }

  const skipBiodata = new Set([...SKIP_BASE, 'created_at', 'updated_at'])
  if (biodata) {
    for (const [k, v] of Object.entries(biodata as Record<string, unknown>)) {
      if (!skipBiodata.has(k)) flat[`employee_biodata.${k}`] = v
    }
  }

  const skipAddress = new Set([...SKIP_BASE])
  if (address) {
    for (const [k, v] of Object.entries(address as Record<string, unknown>)) {
      if (!skipAddress.has(k)) flat[`employee_address.${k}`] = v
    }
  }

  const skipBank = new Set([...SKIP_BASE])
  if (bank) {
    for (const [k, v] of Object.entries(bank as Record<string, unknown>)) {
      if (!skipBank.has(k)) flat[`employee_bank_details.${k}`] = v
    }
  }

  const skipNok = new Set([...SKIP_BASE, 'created_at', 'purpose'])
  if (nok) {
    for (const [k, v] of Object.entries(nok as Record<string, unknown>)) {
      if (!skipNok.has(k)) flat[`employee_next_of_kin.${k}`] = v
    }
  }

  return flat
}

// ─── Pending fields ───────────────────────────────────────────────────────────

/**
 * Returns the set of field_key strings that already have a pending
 * profile_update_request_items row for this employee. These fields
 * must be shown as disabled in the form.
 */
export async function getPendingFieldsForEmployee(): Promise<string[]> {
  const ctx = await getEssContext()
  if ('error' in ctx) return []

  const { supabase, employeeId, orgId } = ctx

  const { data: requests } = await supabase
    .from('approval_requests')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('organization_id', orgId)
    .eq('request_type', 'PROFILE_UPDATE')
    .in('status', ['pending', 'partially_approved'])

  if (!requests?.length) return []

  const requestIds = (requests as Array<{ id: string }>).map((r) => r.id)

  const { data: items } = await supabase
    .from('approval_items')
    .select('field_name')
    .in('request_id', requestIds)
    .eq('status', 'pending')
    .eq('item_type', 'FIELD')

  return ((items ?? []) as Array<{ field_name: string }>).map((i) => i.field_name)
}

// ─── Multi-record loaders for Relations / Career ─────────────────────────────

export type PersonRecord = {
  id: string
  title: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
  relationship: string
  address: string
}

export type NextOfKinRecord = PersonRecord & {
  purpose: string
}

export type ExperienceRecord = {
  id: string
  company: string
  position: string
  address: string
  phone: string | null
  email: string | null
  reason_for_leaving: string | null
  start_date: string
  end_date: string | null
}

export type EducationRecord = {
  id: string
  school: string
  course: string
  degree: string
  grade: string | null
  start_date: string
  end_date: string | null
}

export type TrainingRecord = {
  id: string
  institution: string
  course: string
  license_name: string | null
  issuing_body: string | null
  start_date: string
  end_date: string | null
}

export type PendingRecordCreate = {
  id: string
  request_id: string
  target_table: string
  field_group: string
  payload: Record<string, unknown>
  created_at: string
}

export type EmployeeCollectionsForEss = {
  /** The current ESS user's employee row id — used to scope API calls. */
  employeeId: string
  family: PersonRecord[]
  dependants: PersonRecord[]
  nextOfKin: NextOfKinRecord[]
  experience: ExperienceRecord[]
  education: EducationRecord[]
  training: TrainingRecord[]
  pendingRecordCreates: PendingRecordCreate[]
}

export async function getEmployeeCollectionsForEss(): Promise<EmployeeCollectionsForEss | null> {
  const ctx = await getEssContext()
  if ('error' in ctx) return null

  const { supabase, employeeId, orgId } = ctx

  const [
    { data: family },
    { data: dependants },
    { data: nextOfKin },
    { data: experience },
    { data: education },
    { data: training },
    { data: pendingRequests },
  ] = await Promise.all([
    supabase
      .from('employee_family')
      .select('id, title, first_name, last_name, phone, email, relationship, address')
      .eq('employee_id', employeeId)
      .eq('organization_id', orgId)
      .order('created_at'),
    supabase
      .from('employee_dependants')
      .select('id, title, first_name, last_name, phone, email, relationship, address')
      .eq('employee_id', employeeId)
      .eq('organization_id', orgId)
      .order('created_at'),
    supabase
      .from('employee_next_of_kin')
      .select('id, title, first_name, last_name, phone, email, relationship, purpose, address')
      .eq('employee_id', employeeId)
      .eq('organization_id', orgId)
      .order('created_at'),
    supabase
      .from('employee_experience')
      .select('id, company, position, address, phone, email, reason_for_leaving, start_date, end_date')
      .eq('employee_id', employeeId)
      .eq('organization_id', orgId)
      .order('created_at'),
    supabase
      .from('employee_education')
      .select('id, school, course, degree, grade, start_date, end_date')
      .eq('employee_id', employeeId)
      .eq('organization_id', orgId)
      .order('created_at'),
    supabase
      .from('employee_training')
      .select('id, institution, course, license_name, issuing_body, start_date, end_date')
      .eq('employee_id', employeeId)
      .eq('organization_id', orgId)
      .order('created_at'),
    supabase
      .from('approval_requests')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('organization_id', orgId)
      .eq('request_type', 'PROFILE_UPDATE')
      .in('status', ['pending', 'partially_approved']),
  ])

  let pendingRecordCreates: PendingRecordCreate[] = []

  if (pendingRequests?.length) {
    const requestIds = (pendingRequests as Array<{ id: string }>).map((row) => row.id)
    const { data: pendingItems } = await supabase
      .from('approval_items')
      .select('id, request_id, target_table, field_group, new_value, created_at')
      .in('request_id', requestIds)
      .eq('status', 'pending')
      .eq('operation', 'create_record')
      .eq('item_type', 'FIELD')

    pendingRecordCreates = ((pendingItems ?? []) as Array<{
      id: string
      request_id: string
      target_table: string | null
      field_group: string
      new_value: Record<string, unknown> | null
      created_at: string
    }>)
      .filter((row) => !!row.target_table)
      .map((row) => ({
        id: row.id,
        request_id: row.request_id,
        target_table: row.target_table ?? '',
        field_group: row.field_group,
        payload: row.new_value ?? {},
        created_at: row.created_at,
      }))
  }

  return {
    employeeId,
    family: (family ?? []) as PersonRecord[],
    dependants: (dependants ?? []) as PersonRecord[],
    nextOfKin: (nextOfKin ?? []) as NextOfKinRecord[],
    experience: (experience ?? []) as ExperienceRecord[],
    education: (education ?? []) as EducationRecord[],
    training: (training ?? []) as TrainingRecord[],
    pendingRecordCreates,
  }
}
