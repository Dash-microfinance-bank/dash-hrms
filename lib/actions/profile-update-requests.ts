'use server'

import { revalidatePath } from 'next/cache'
import { getEmployeeProfileSchema } from '@/lib/data/employee-permissions'
import { getEssContext, getCurrentEmployeeProfileForEss } from '@/lib/data/employee-profile'

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

  // Reject if any requested field already has an open pending item
  const { data: pendingRequests } = await supabase
    .from('profile_update_requests')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('organization_id', orgId)
    .in('status', ['pending', 'partially_approved'])

  if (pendingRequests?.length && hasScalarChanges) {
    const reqIds = (pendingRequests as Array<{ id: string }>).map((r) => r.id)

    const { data: pendingItems } = await supabase
      .from('profile_update_request_items')
      .select('field_name')
      .in('request_id', reqIds)
      .eq('status', 'pending')
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

  // Insert the parent request row
  const { data: request, error: requestError } = await supabase
    .from('profile_update_requests')
    .insert({ employee_id: employeeId, organization_id: orgId, status: 'pending' })
    .select('id')
    .single()

  if (requestError || !request) {
    return { success: false, error: requestError?.message ?? 'Failed to create request' }
  }

  const requestId = (request as { id: string }).id

  // One item row per changed field
  const scalarItems = hasScalarChanges
    ? Object.entries(changes).map(([fieldKey, newVal]) => {
        const perm = permMap.get(fieldKey)!
        const oldVal = currentProfile[fieldKey]
        return {
          request_id: requestId,
          organization_id: orgId,
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
    .from('profile_update_request_items')
    .insert(items)

  if (itemsError) {
    // Best-effort rollback — the request row won't have items so HR will skip it
    await supabase.from('profile_update_requests').delete().eq('id', requestId)
    return { success: false, error: itemsError.message }
  }

  // Audit trail
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
