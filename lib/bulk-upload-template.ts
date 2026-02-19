/** Template column headers (business contract) - shared with API and UI */
export const BULK_UPLOAD_TEMPLATE_HEADERS = [
  'staff_id',
  'first_name',
  'last_name',
  'email',
  'phone_number',
  'gender',
  'contract_type',
  'employment_status',
  'start_date',
  'end_date',
  'department',
  'job_role',
  'work_location',
] as const

export type BulkUploadTemplateHeader =
  (typeof BULK_UPLOAD_TEMPLATE_HEADERS)[number]

export const REQUIRED_FIELDS: BulkUploadTemplateHeader[] = [
  'first_name',
  'last_name',
  'email',
  'start_date',
  'department',
  'job_role',
]

export const GENDER_VALUES = [
  'male',
  'female',
  'other',
  'prefer_not_to_say',
] as const

export const CONTRACT_TYPE_VALUES = [
  'permanent',
  'part_time',
  'fixed_term',
  'contractor',
  'intern',
  'temporary',
] as const

export const EMPLOYMENT_STATUS_VALUES = ['probation', 'confirmed'] as const

export type ParsedBulkRow = Record<BulkUploadTemplateHeader, string>

export type RowValidation = {
  valid: boolean
  error?: string
}

function isNonEmpty(s: string): boolean {
  return typeof s === 'string' && s.trim().length > 0
}

function oneOf<T extends string>(value: string, options: readonly T[]): boolean {
  const v = value?.trim().toLowerCase()
  return v === '' || options.some((o) => o === v)
}

export function validateBulkRow(
  row: ParsedBulkRow,
  rowIndex: number
): RowValidation {
  const errors: string[] = []

  for (const field of REQUIRED_FIELDS) {
    if (!isNonEmpty(row[field] ?? '')) {
      errors.push(`${field} is required`)
    }
  }

  if (row.gender?.trim() && !oneOf(row.gender, GENDER_VALUES)) {
    errors.push(
      `gender must be one of: ${GENDER_VALUES.join(', ')}`
    )
  }
  if (row.contract_type?.trim() && !oneOf(row.contract_type, CONTRACT_TYPE_VALUES)) {
    errors.push(
      `contract_type must be one of: ${CONTRACT_TYPE_VALUES.join(', ')}`
    )
  }
  if (row.employment_status?.trim() && !oneOf(row.employment_status, EMPLOYMENT_STATUS_VALUES)) {
    errors.push(
      `employment_status must be one of: ${EMPLOYMENT_STATUS_VALUES.join(', ')}`
    )
  }

  const email = row.email?.trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('email must be a valid email address')
  }

  const startDate = row.start_date?.trim()
  if (startDate && Number.isNaN(Date.parse(startDate))) {
    errors.push('start_date must be a valid date')
  }
  const endDate = row.end_date?.trim()
  if (endDate && Number.isNaN(Date.parse(endDate))) {
    errors.push('end_date must be a valid date')
  }

  if (errors.length === 0) {
    return { valid: true }
  }
  return { valid: false, error: errors.join('; ') }
}
