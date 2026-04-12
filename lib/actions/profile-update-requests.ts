'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getEmployeeProfileSchema } from '@/lib/data/employee-permissions'
import { getEssContext, getCurrentEmployeeProfileForEss } from '@/lib/data/employee-profile'

const PROFILE_UPDATE_REQUEST_TYPE = 'PROFILE_UPDATE'
const PROFILE_UPDATE_REQUEST_SOURCE = 'ESS_PROFILE_FORM'

export type ReviewActionResult = { success: true } | { success: false; error: string }

/** Tables keyed by employee_id: one row per employee. Approval updates these. */
const EMPLOYEE_ID_KEYED_TABLES = new Set([
  'employee_biodata',
  'employee_address',   // residential address: residential_address, nearest_bus_stop, city, state, country, etc.
  'employee_bank_details', // banking & finance: bank_name, account_name, account_number, bvn, nin, pfa, rsa_pin, tax_id, nhf_id, etc.
])
const RECORD_CREATE_TABLES = new Set<RecordCreateTable>([
  'employee_family',
  'employee_dependants',
  'employee_next_of_kin',
  'employee_experience',
  'employee_education',
  'employee_training',
])

type ItemForApply = {
  operation: 'field_update' | 'create_record'
  field_name: string
  new_value: unknown
  target_table: string | null
}

/**
 * Applies an approved profile-update item to the employee's actual data.
 * Multi-tenant: all updates are scoped by organization_id and employee_id.
 */
async function applyApprovedItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  employeeId: string,
  item: ItemForApply
): Promise<{ success: true } | { success: false; error: string }> {
  if (item.operation === 'field_update') {
    const parts = item.field_name.includes('.') ? item.field_name.split('.') : []
    if (parts.length !== 2) return { success: false, error: `Invalid field_name: ${item.field_name}` }
    const [table, column] = parts
    const raw = item.new_value && typeof item.new_value === 'object' && 'value' in item.new_value
      ? (item.new_value as { value: unknown }).value
      : item.new_value
    const value = raw === undefined ? null : raw

    if (table === 'employees') {
      const { error } = await supabase
        .from('employees')
        .update({ [column]: value })
        .eq('id', employeeId)
        .eq('organization_id', orgId)
      if (error) return { success: false, error: error.message }
      return { success: true }
    }

    if (EMPLOYEE_ID_KEYED_TABLES.has(table)) {
      // Single-row-per-employee tables: use upsert so we insert when no row exists (e.g. first address/bank approval).
      // Residential address → employee_address; banking/finance → employee_bank_details; biodata → employee_biodata.
      const row = {
        employee_id: employeeId,
        organization_id: orgId,
        [column]: value,
      } as Record<string, unknown>
      // Match employee-update.ts: upsert so missing address/bank rows are created. If your schema uses a composite unique on (employee_id, organization_id), use onConflict: 'employee_id,organization_id'.
      const { error } = await supabase
        .from(table)
        .upsert(row, { onConflict: 'employee_id' })
      if (error) return { success: false, error: error.message }
      return { success: true }
    }

    return { success: false, error: `Unknown table for field_update: ${table}` }
  }

  if (item.operation === 'create_record' && item.target_table) {
    if (!RECORD_CREATE_TABLES.has(item.target_table as RecordCreateTable)) {
      return { success: false, error: `Invalid target_table: ${item.target_table}` }
    }
    const payload = (item.new_value && typeof item.new_value === 'object'
      ? { ...(item.new_value as Record<string, unknown>) }
      : {}) as Record<string, unknown>
    const { error } = await supabase
      .from(item.target_table)
      .insert({
        ...payload,
        employee_id: employeeId,
        organization_id: orgId,
      })
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  return { success: false, error: 'Invalid item operation or missing target_table' }
}

async function getCurrentUserOrgId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  return (profile as { organization_id: string } | null)?.organization_id ?? null
}

export type ProfileUpdateRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'partially_approved'

/**
 * Derives the profile_update_requests.status from item status counts.
 * - Any pending item → pending
 * - No pending: all rejected → rejected; all approved → approved; else → partially_approved
 */
function deriveRequestStatusFromItemCounts(
  pending: number,
  approved: number,
  rejected: number
): ProfileUpdateRequestStatus {
  if (pending > 0) return 'pending'
  const total = approved + rejected
  if (total === 0) return 'pending'
  if (rejected === total) return 'rejected'
  if (approved === total) return 'approved'
  return 'partially_approved'
}

/**
 * Recomputes profile_update_requests.status from current profile_update_request_items
 * and updates the request row. Multi-tenant: scoped by organization_id.
 */
async function syncProfileUpdateRequestStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestId: string,
  orgId: string
): Promise<ReviewActionResult> {
  const { data: items, error: itemsError } = await supabase
    .from('approval_items')
    .select('status')
    .eq('request_id', requestId)
    .eq('item_type', 'FIELD')
  if (itemsError) return { success: false, error: itemsError.message }
  const list = (items ?? []) as Array<{ status: string }>
  const pending = list.filter((i) => i.status === 'pending').length
  const approved = list.filter((i) => i.status === 'approved').length
  const rejected = list.filter((i) => i.status === 'rejected').length
  const newStatus = deriveRequestStatusFromItemCounts(pending, approved, rejected)
  const { error: updateError } = await supabase
    .from('approval_requests')
    .update({ status: newStatus })
    .eq('id', requestId)
    .eq('organization_id', orgId)
    .eq('request_type', PROFILE_UPDATE_REQUEST_TYPE)
  if (updateError) return { success: false, error: updateError.message }
  return { success: true }
}

export type ProfileUpdateRequestResult =
  | { success: true; requestId: string }
  | { success: false; error: string }

export type RecordCreateTable =
  | 'employee_family'
  | 'employee_dependants'
  | 'employee_next_of_kin'
  | 'employee_experience'
  | 'employee_education'
  | 'employee_training'

export type RecordCreateRequest = {
  table: RecordCreateTable
  payload: Record<string, unknown>
}

/**
 * Groups backed by a single DB row per employee.
 * These are the only groups supported by the request form in v1.
 * Multi-record groups (Education, Work Experience, etc.) are excluded.
 */
const SINGLE_RECORD_GROUPS = new Set([
  'Personal Information',
  'Contact Information',
  'Address Information',
  'Financial Information',
  'Emergency Contacts',
])

const RECORD_CREATE_CONFIG: Record<
  RecordCreateTable,
  {
    fieldGroup: string
    requiredKeys: string[]
    allowedKeys: string[]
  }
> = {
  employee_family: {
    fieldGroup: 'Family',
    requiredKeys: ['title', 'first_name', 'last_name', 'phone', 'relationship', 'address'],
    allowedKeys: ['title', 'first_name', 'last_name', 'phone', 'email', 'relationship', 'address'],
  },
  employee_dependants: {
    fieldGroup: 'Dependants',
    requiredKeys: ['title', 'first_name', 'last_name', 'phone', 'relationship', 'address'],
    allowedKeys: ['title', 'first_name', 'last_name', 'phone', 'email', 'relationship', 'address'],
  },
  employee_next_of_kin: {
    fieldGroup: 'Next of Kin',
    requiredKeys: ['title', 'first_name', 'last_name', 'phone', 'relationship', 'purpose', 'address'],
    allowedKeys: ['title', 'first_name', 'last_name', 'phone', 'email', 'relationship', 'purpose', 'address'],
  },
  employee_experience: {
    fieldGroup: 'Work Experience',
    requiredKeys: ['company', 'position', 'address', 'start_date'],
    allowedKeys: ['company', 'position', 'address', 'phone', 'email', 'reason_for_leaving', 'start_date', 'end_date'],
  },
  employee_education: {
    fieldGroup: 'Education',
    requiredKeys: ['school', 'course', 'degree', 'start_date'],
    allowedKeys: ['school', 'course', 'degree', 'grade', 'start_date', 'end_date'],
  },
  employee_training: {
    fieldGroup: 'Training & Certifications',
    requiredKeys: ['institution', 'course', 'start_date'],
    allowedKeys: ['institution', 'course', 'license_name', 'issuing_body', 'start_date', 'end_date'],
  },
}

/**
 * Creates a profile_update_request plus one profile_update_request_items
 * row per changed field, then writes an audit log entry.
 *
 * Security guarantees (server-enforced):
 *  - Caller must be an authenticated employee in an active org.
 *  - Only fields with can_read=true and can_write=true in their org schema are accepted.
 *  - Fields already covered by a pending item are rejected.
 *  - old_value is always sourced from the canonical DB snapshot, not from the client.
 */
export async function createProfileUpdateRequestFromEss(
  changes: Record<string, unknown>,
  recordCreates: RecordCreateRequest[] = []
): Promise<ProfileUpdateRequestResult> {
  const ctx = await getEssContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const { supabase, employeeId, orgId, userId } = ctx

  const hasScalarChanges = !!changes && Object.keys(changes).length > 0
  const hasRecordCreates = recordCreates.length > 0

  if (!hasScalarChanges && !hasRecordCreates) {
    return { success: false, error: 'No changes provided' }
  }

  // Validate against the org's schema
  const schema = await getEmployeeProfileSchema()
  if (!schema) return { success: false, error: 'Profile permissions not configured for your organization' }

  const permMap = new Map<
    string,
    { can_read: boolean; can_write: boolean; group_name: string; label: string }
  >()
  for (const [groupName, fields] of Object.entries(schema)) {
    for (const field of fields) {
      permMap.set(field.field_key, {
        can_read: field.can_read,
        can_write: field.can_write,
        group_name: groupName,
        label: field.label,
      })
    }
  }

  if (hasScalarChanges) {
    for (const fieldKey of Object.keys(changes)) {
      const perm = permMap.get(fieldKey)
      if (!perm) return { success: false, error: `Unknown field: ${fieldKey}` }
      if (!perm.can_read) return { success: false, error: `Field "${fieldKey}" is not visible` }
      if (!perm.can_write) return { success: false, error: `Field "${fieldKey}" is not editable` }
      if (!SINGLE_RECORD_GROUPS.has(perm.group_name)) {
        return { success: false, error: `Field "${fieldKey}" cannot be updated via profile requests` }
      }
    }
  }

  for (const record of recordCreates) {
    const config = RECORD_CREATE_CONFIG[record.table]
    if (!config) {
      return { success: false, error: `Unsupported request table: ${record.table}` }
    }

    const keys = Object.keys(record.payload ?? {})
    for (const key of keys) {
      if (!config.allowedKeys.includes(key)) {
        return { success: false, error: `Field "${key}" is not allowed for ${config.fieldGroup}` }
      }
    }

    for (const key of config.requiredKeys) {
      const value = record.payload?.[key]
      if (value === null || value === undefined || value === '') {
        return { success: false, error: `${config.fieldGroup}: ${key} is required` }
      }
    }
  }

  // Canonical old values come from DB, never from the client
  const currentProfileRaw = hasScalarChanges ? await getCurrentEmployeeProfileForEss() : {}
  if (hasScalarChanges && !currentProfileRaw) {
    return { success: false, error: 'Failed to load current profile data' }
  }
  const currentProfile: Record<string, unknown> = (currentProfileRaw ?? {}) as Record<string, unknown>

  // Resolve at most one open request for this employee (most recent)
  const { data: openRequestRows } = await supabase
    .from('approval_requests')
    .select('id, status')
    .eq('employee_id', employeeId)
    .eq('organization_id', orgId)
    .eq('request_type', PROFILE_UPDATE_REQUEST_TYPE)
    .in('status', ['pending', 'partially_approved'])
    .order('created_at', { ascending: false })
    .limit(1)

  const existingRequest =
    openRequestRows && openRequestRows.length > 0
      ? (openRequestRows[0] as { id: string; status: ProfileUpdateRequestStatus })
      : null

  let reusableRequestId: string | null = null

  if (existingRequest) {
    if (existingRequest.status === 'pending') {
      reusableRequestId = existingRequest.id
    } else if (existingRequest.status === 'partially_approved') {
      // Only reuse a partially approved request if it still has pending items.
      const { data: pendingForExisting } = await supabase
        .from('approval_items')
        .select('id')
        .eq('request_id', existingRequest.id)
        .eq('status', 'pending')
        .eq('item_type', 'FIELD')
        .limit(1)
      const hasPending = (pendingForExisting ?? []).length > 0
      if (hasPending) {
        reusableRequestId = existingRequest.id
      }
    }
  }

  if (reusableRequestId) {
    // Reuse path: append only new items to the existing request
    const { data: pendingItemsForRequest } = await supabase
      .from('approval_items')
      .select('field_name')
      .eq('request_id', reusableRequestId)
      .eq('status', 'pending')
      .eq('operation', 'field_update')
      .eq('item_type', 'FIELD')

    const alreadyPendingFields = new Set(
      ((pendingItemsForRequest ?? []) as Array<{ field_name: string }>).map((r) => r.field_name)
    )

    const filteredChanges = hasScalarChanges
      ? Object.entries(changes).filter(([fieldKey]) => !alreadyPendingFields.has(fieldKey))
      : []

    const scalarItems = filteredChanges.map(([fieldKey, newVal]) => {
      const perm = permMap.get(fieldKey)!
      const oldVal = currentProfile[fieldKey]
      return {
        request_id: reusableRequestId,
        organization_id: orgId,
        item_type: 'FIELD' as const,
        document_version_id: null,
        field_name: fieldKey,
        field_group: perm.group_name,
        old_value: oldVal !== undefined ? { value: oldVal } : null,
        new_value: { value: newVal },
        status: 'pending' as const,
        operation: 'field_update' as const,
        target_table: null,
        target_row_id: null,
      }
    })

    const recordItems = recordCreates.map((record) => ({
      request_id: reusableRequestId,
      organization_id: orgId,
      item_type: 'FIELD' as const,
      document_version_id: null,
      field_name: `${record.table}.create`,
      field_group: RECORD_CREATE_CONFIG[record.table].fieldGroup,
      old_value: null,
      new_value: record.payload,
      status: 'pending' as const,
      operation: 'create_record' as const,
      target_table: record.table,
      target_row_id: null,
    }))

    const items = [...scalarItems, ...recordItems]

    if (items.length === 0) {
      return {
        success: false,
        error:
          'All requested fields already have pending changes in your open request. Add different fields or wait for HR review.',
      }
    }

    const { error: itemsError } = await supabase
      .from('approval_items')
      .insert(items)

    if (itemsError) {
      return { success: false, error: itemsError.message }
    }

    await supabase.from('audit_logs').insert({
      organization_id: orgId,
      actor_id: userId,
      action: 'employee_profile_update_requested',
      resource_type: 'profile_update_request',
      resource_id: reusableRequestId,
      new_value: {
        appended_field_keys: filteredChanges.map(([k]) => k),
        appended_field_count: scalarItems.length,
        appended_record_create_tables: recordCreates.map((r) => r.table),
        appended_record_count: recordItems.length,
      },
    })

    revalidatePath('/dashboard/profile-update-request')
    return { success: true, requestId: reusableRequestId }
  }

  // New request path: reject if any requested field already has a pending item (any open request)
  const { data: pendingRequests } = await supabase
    .from('approval_requests')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('organization_id', orgId)
    .eq('request_type', PROFILE_UPDATE_REQUEST_TYPE)
    .in('status', ['pending', 'partially_approved'])

  if (pendingRequests?.length && hasScalarChanges) {
    const reqIds = (pendingRequests as Array<{ id: string }>).map((r) => r.id)
    const { data: pendingItems } = await supabase
      .from('approval_items')
      .select('field_name')
      .in('request_id', reqIds)
      .eq('status', 'pending')
      .eq('item_type', 'FIELD')
      .in('field_name', Object.keys(changes))

    if (pendingItems?.length) {
      const blocked = (pendingItems as Array<{ field_name: string }>)
        .map((i) => {
          const p = permMap.get(i.field_name)
          return p ? p.label : i.field_name
        })
        .join(', ')
      return {
        success: false,
        error: `These fields already have pending requests: ${blocked}`,
      }
    }
  }

  const { data: request, error: requestError } = await supabase
    .from('approval_requests')
    .insert({
      employee_id: employeeId,
      organization_id: orgId,
      status: 'pending',
      request_type: PROFILE_UPDATE_REQUEST_TYPE,
      source: PROFILE_UPDATE_REQUEST_SOURCE,
    })
    .select('id')
    .single()

  if (requestError || !request) {
    return { success: false, error: requestError?.message ?? 'Failed to create request' }
  }

  const requestId = (request as { id: string }).id

  const scalarItems = hasScalarChanges
    ? Object.entries(changes).map(([fieldKey, newVal]) => {
        const perm = permMap.get(fieldKey)!
        const oldVal = currentProfile[fieldKey]
        return {
          request_id: requestId,
          organization_id: orgId,
          item_type: 'FIELD' as const,
          document_version_id: null,
          field_name: fieldKey,
          field_group: perm.group_name,
          old_value: oldVal !== undefined ? { value: oldVal } : null,
          new_value: { value: newVal },
          status: 'pending' as const,
          operation: 'field_update' as const,
          target_table: null,
          target_row_id: null,
        }
      })
    : []

  const recordItems = recordCreates.map((record) => ({
    request_id: requestId,
    organization_id: orgId,
    item_type: 'FIELD' as const,
    document_version_id: null,
    field_name: `${record.table}.create`,
    field_group: RECORD_CREATE_CONFIG[record.table].fieldGroup,
    old_value: null,
    new_value: record.payload,
    status: 'pending' as const,
    operation: 'create_record' as const,
    target_table: record.table,
    target_row_id: null,
  }))

  const items = [...scalarItems, ...recordItems]

  const { error: itemsError } = await supabase
    .from('approval_items')
    .insert(items)

  if (itemsError) {
    await supabase
      .from('approval_requests')
      .delete()
      .eq('id', requestId)
      .eq('request_type', PROFILE_UPDATE_REQUEST_TYPE)
    return { success: false, error: itemsError.message }
  }

  await supabase.from('audit_logs').insert({
    organization_id: orgId,
    actor_id: userId,
    action: 'employee_profile_update_requested',
    resource_type: 'profile_update_request',
    resource_id: requestId,
    new_value: {
      field_keys: Object.keys(changes),
      field_count: Object.keys(changes).length,
      record_create_tables: recordCreates.map((record) => record.table),
      record_create_count: recordCreates.length,
    },
  })

  revalidatePath('/dashboard/profile-update-request')
  return { success: true, requestId }
}

export async function approveProfileUpdateItem(itemId: string): Promise<ReviewActionResult> {
  const orgId = await getCurrentUserOrgId()
  if (!orgId) return { success: false, error: 'Not authenticated' }
  const supabase = await createClient()
  const { data: item, error: itemError } = await supabase
    .from('approval_items')
    .select('id, request_id, operation, field_name, new_value, target_table')
    .eq('id', itemId)
    .eq('item_type', 'FIELD')
    .single()
  if (itemError || !item) return { success: false, error: 'Item not found' }
  const { data: req } = await supabase
    .from('approval_requests')
    .select('id, employee_id, organization_id')
    .eq('id', (item as { request_id: string }).request_id)
    .eq('request_type', PROFILE_UPDATE_REQUEST_TYPE)
    .single()
  if (!req || (req as { organization_id: string }).organization_id !== orgId)
    return { success: false, error: 'Request not found or access denied' }
  const employeeId = (req as { employee_id: string }).employee_id
  const applyResult = await applyApprovedItem(
    supabase,
    orgId,
    employeeId,
    item as unknown as ItemForApply
  )
  if (!applyResult.success) return applyResult
  const { error: updateError } = await supabase
    .from('approval_items')
    .update({ status: 'approved' })
    .eq('id', itemId)
  if (updateError) return { success: false, error: updateError.message }
  const syncResult = await syncProfileUpdateRequestStatus(
    supabase,
    (item as { request_id: string }).request_id,
    orgId
  )
  if (!syncResult.success) return syncResult
  revalidatePath('/dashboard/admin/employees/profile-update-requests')
  revalidatePath('/dashboard/admin/employees')
  return { success: true }
}

export async function rejectProfileUpdateItem(itemId: string): Promise<ReviewActionResult> {
  const orgId = await getCurrentUserOrgId()
  if (!orgId) return { success: false, error: 'Not authenticated' }
  const supabase = await createClient()
  const { data: item, error: itemError } = await supabase
    .from('approval_items')
    .select('id, request_id')
    .eq('id', itemId)
    .eq('item_type', 'FIELD')
    .single()
  if (itemError || !item) return { success: false, error: 'Item not found' }
  const { data: req } = await supabase
    .from('approval_requests')
    .select('id, organization_id')
    .eq('id', (item as { request_id: string }).request_id)
    .eq('request_type', PROFILE_UPDATE_REQUEST_TYPE)
    .single()
  if (!req || (req as { organization_id: string }).organization_id !== orgId)
    return { success: false, error: 'Request not found or access denied' }
  const { error: updateError } = await supabase
    .from('approval_items')
    .update({ status: 'rejected' })
    .eq('id', itemId)
  if (updateError) return { success: false, error: updateError.message }
  const syncResult = await syncProfileUpdateRequestStatus(
    supabase,
    (item as { request_id: string }).request_id,
    orgId
  )
  if (!syncResult.success) return syncResult
  revalidatePath('/dashboard/admin/employees/profile-update-requests')
  return { success: true }
}

export async function approveAllProfileUpdateRequest(requestId: string): Promise<ReviewActionResult> {
  const orgId = await getCurrentUserOrgId()
  if (!orgId) return { success: false, error: 'Not authenticated' }
  const supabase = await createClient()
  const { data: req, error: reqError } = await supabase
    .from('approval_requests')
    .select('id, employee_id, organization_id')
    .eq('id', requestId)
    .eq('request_type', PROFILE_UPDATE_REQUEST_TYPE)
    .single()
  if (reqError || !req || (req as { organization_id: string }).organization_id !== orgId)
    return { success: false, error: 'Request not found or access denied' }
  const employeeId = (req as { employee_id: string }).employee_id
  const { data: pendingItems, error: itemsError } = await supabase
    .from('approval_items')
    .select('id, operation, field_name, new_value, target_table')
    .eq('request_id', requestId)
    .eq('status', 'pending')
    .eq('item_type', 'FIELD')
  if (itemsError) return { success: false, error: itemsError.message }
  const items = (pendingItems ?? []) as Array<ItemForApply & { id: string }>
  if (items.length === 0) {
    return { success: false, error: 'No pending items to approve.' }
  }
  for (const item of items) {
    const applyResult = await applyApprovedItem(supabase, orgId, employeeId, item)
    if (!applyResult.success) {
      const context = item.operation === 'field_update' ? item.field_name : item.target_table ?? item.id
      return { success: false, error: `Failed to apply change (${context}): ${applyResult.error}` }
    }
  }
  const { error: updateItemsError } = await supabase
    .from('approval_items')
    .update({ status: 'approved' })
    .eq('request_id', requestId)
    .in('status', ['pending'])
    .eq('item_type', 'FIELD')
  if (updateItemsError) return { success: false, error: updateItemsError.message }
  const syncResult = await syncProfileUpdateRequestStatus(supabase, requestId, orgId)
  if (!syncResult.success) return syncResult
  revalidatePath('/dashboard/admin/employees/profile-update-requests')
  revalidatePath('/dashboard/admin/employees')
  return { success: true }
}

export async function rejectAllProfileUpdateRequest(requestId: string): Promise<ReviewActionResult> {
  const orgId = await getCurrentUserOrgId()
  if (!orgId) return { success: false, error: 'Not authenticated' }
  const supabase = await createClient()
  const { data: req, error: reqError } = await supabase
    .from('approval_requests')
    .select('id, organization_id')
    .eq('id', requestId)
    .eq('request_type', PROFILE_UPDATE_REQUEST_TYPE)
    .single()
  if (reqError || !req || (req as { organization_id: string }).organization_id !== orgId)
    return { success: false, error: 'Request not found or access denied' }
  const { data: pendingRows } = await supabase
    .from('approval_items')
    .select('id')
    .eq('request_id', requestId)
    .eq('status', 'pending')
    .eq('item_type', 'FIELD')
  const pendingCount = (pendingRows ?? []).length
  if (pendingCount === 0) {
    return { success: false, error: 'No pending items to reject.' }
  }
  const { error: updateItemsError } = await supabase
    .from('approval_items')
    .update({ status: 'rejected' })
    .eq('request_id', requestId)
    .in('status', ['pending'])
    .eq('item_type', 'FIELD')
  if (updateItemsError) return { success: false, error: updateItemsError.message }
  const syncResult = await syncProfileUpdateRequestStatus(supabase, requestId, orgId)
  if (!syncResult.success) return syncResult
  revalidatePath('/dashboard/admin/employees/profile-update-requests')
  return { success: true }
}
