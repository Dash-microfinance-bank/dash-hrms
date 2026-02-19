import { NextRequest, NextResponse } from 'next/server'
import { parse as parseCsvSync } from 'csv-parse/sync'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import {
  GENDER_VALUES,
  CONTRACT_TYPE_VALUES,
  EMPLOYMENT_STATUS_VALUES,
  BULK_UPLOAD_TEMPLATE_HEADERS,
  type BulkUploadTemplateHeader,
  type ParsedBulkRow,
} from '@/lib/bulk-upload-template'

// Must run in Node.js — ExcelJS uses Node streams; Supabase auth needs full HTTP stack.
export const runtime = 'nodejs'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_ROWS = 1000

// ─── Types ────────────────────────────────────────────────────────────────────

export type PreviewRowStatus = 'valid' | 'invalid'

export interface PreviewRow {
  row_number: number
  data: ParsedBulkRow
  status: PreviewRowStatus
  error_message: string | null
}

export interface PreviewResponse {
  total_rows: number
  valid_rows: number
  invalid_rows: number
  preview_data: PreviewRow[]
}

/** Batch-loaded org reference data used for all row validations. */
interface OrgContext {
  /** lowercase department name → { id, is_active } */
  departments: Map<string, { id: string; is_active: boolean }>
  /** lowercase job role title → { id, is_active } */
  jobRoles: Map<string, { id: string; is_active: boolean }>
  /** set of lowercase emails already in the org */
  existingEmails: Set<string>
  /** lowercase address → id (work_location validation) */
  locations: Map<string, string>
}

// ─── File parsing helpers ─────────────────────────────────────────────────────

function normalizeHeaderKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
}

function buildParsedRow(
  headerKeys: string[],
  rawValues: string[]
): ParsedBulkRow {
  const obj: Record<string, string> = {}
  headerKeys.forEach((key, i) => {
    obj[key] = (rawValues[i] ?? '').trim()
  })
  const row = {} as Record<BulkUploadTemplateHeader, string>
  for (const field of BULK_UPLOAD_TEMPLATE_HEADERS) {
    row[field] = obj[field] ?? ''
  }
  return row as ParsedBulkRow
}

function parseCsv(content: string): ParsedBulkRow[] {
  // csv-parse/sync handles quoted fields, CRLF/LF, empty lines.
  const records = parseCsvSync(content, {
    skip_empty_lines: true,
    relax_column_count: true, // tolerate rows with fewer columns than header
    trim: true,
  }) as string[][]

  if (records.length < 2) return []
  const headerKeys = records[0].map(normalizeHeaderKey)
  return records.slice(1).map((row) => buildParsedRow(headerKeys, row))
}

/**
 * ExcelJS CellValue can be many types; coerce everything to a plain string.
 */
function cellValueToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  // Formula cell
  if (typeof value === 'object' && 'result' in value) {
    return cellValueToString(value.result as ExcelJS.CellValue)
  }
  // Rich text
  if (typeof value === 'object' && 'richText' in value) {
    return (value as ExcelJS.CellRichTextValue).richText
      .map((rt) => rt.text)
      .join('')
  }
  // Error
  if (typeof value === 'object' && 'error' in value) return ''
  return String(value)
}

async function parseExcel(buffer: Buffer): Promise<ParsedBulkRow[]> {
  const workbook = new ExcelJS.Workbook()
  // ExcelJS's .d.ts bundles an older Buffer interface (pre-Node 22, lacks maxByteLength /
  // resizable) that conflicts with @types/node ≥20's generic Buffer<ArrayBufferLike>.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any)

  const sheet = workbook.worksheets[0]
  if (!sheet || sheet.rowCount < 2) return []

  // Collect all non-empty rows into string[][] first
  const rawRows: string[][] = []
  sheet.eachRow({ includeEmpty: false }, (row) => {
    // row.values is 1-indexed sparse array; slice(1) removes the undefined at [0]
    const values = (row.values as ExcelJS.CellValue[])
      .slice(1)
      .map(cellValueToString)
    rawRows.push(values)
  })

  if (rawRows.length < 2) return []
  const headerKeys = rawRows[0].map(normalizeHeaderKey)
  return rawRows.slice(1).map((row) => buildParsedRow(headerKeys, row))
}

// ─── Validation ───────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateRow(
  row: ParsedBulkRow,
  rowNumber: number,
  ctx: OrgContext,
  /** Tracks emails seen in previous rows of this upload for intra-file duplicate detection */
  fileEmails: Set<string>
): string[] {
  const errors: string[] = []

  // ── Required text fields ───────────────────────────────────────────────────
  if (!row.first_name) errors.push('first_name is required')
  if (!row.last_name) errors.push('last_name is required')
  if (!row.start_date) errors.push('start_date is required')

  // ── Email: required, format, org-uniqueness, intra-file dedup ─────────────
  const email = row.email.toLowerCase()
  if (!email) {
    errors.push('email is required')
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push('email is not a valid email address')
  } else if (ctx.existingEmails.has(email)) {
    errors.push('email already exists in this organization')
  } else if (fileEmails.has(email)) {
    errors.push('email is duplicated within this upload')
  }

  // ── Enum fields ────────────────────────────────────────────────────────────
  if (row.gender && !GENDER_VALUES.includes(row.gender.toLowerCase() as typeof GENDER_VALUES[number])) {
    errors.push(`gender must be one of: ${GENDER_VALUES.join(', ')}`)
  }
  if (row.contract_type && !CONTRACT_TYPE_VALUES.includes(row.contract_type.toLowerCase() as typeof CONTRACT_TYPE_VALUES[number])) {
    errors.push(`contract_type must be one of: ${CONTRACT_TYPE_VALUES.join(', ')}`)
  }
  if (row.employment_status && !EMPLOYMENT_STATUS_VALUES.includes(row.employment_status.toLowerCase() as typeof EMPLOYMENT_STATUS_VALUES[number])) {
    errors.push(`employment_status must be one of: ${EMPLOYMENT_STATUS_VALUES.join(', ')}`)
  }

  // ── Date fields ────────────────────────────────────────────────────────────
  if (row.start_date && Number.isNaN(Date.parse(row.start_date))) {
    errors.push('start_date must be a valid date (YYYY-MM-DD)')
  }
  if (row.end_date && Number.isNaN(Date.parse(row.end_date))) {
    errors.push('end_date must be a valid date (YYYY-MM-DD)')
  }

  // ── Department (org-scoped lookup) ─────────────────────────────────────────
  const deptKey = row.department.toLowerCase()
  if (!deptKey) {
    errors.push('department is required')
  } else {
    const dept = ctx.departments.get(deptKey)
    if (!dept) {
      errors.push(`department "${row.department}" does not exist in this organization`)
    } else if (!dept.is_active) {
      errors.push(`department "${row.department}" is inactive`)
    }
  }

  // ── Job role (org-scoped lookup) ───────────────────────────────────────────
  const roleKey = row.job_role.toLowerCase()
  if (!roleKey) {
    errors.push('job_role is required')
  } else {
    const role = ctx.jobRoles.get(roleKey)
    if (!role) {
      errors.push(`job_role "${row.job_role}" does not exist in this organization`)
    } else if (!role.is_active) {
      errors.push(`job_role "${row.job_role}" is inactive`)
    }
  }

  // ── Work location (org-scoped, optional) ───────────────────────────────────
  if (row.work_location) {
    const locKey = row.work_location.toLowerCase()
    if (!ctx.locations.has(locKey)) {
      errors.push(`work_location "${row.work_location}" does not match any office address in this organization`)
    }
  }

  return errors
}

// ─── Org context loader ───────────────────────────────────────────────────────

async function loadOrgContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string
): Promise<OrgContext> {
  // All four queries run in parallel — single round-trip
  const [deptRes, roleRes, emailRes, locRes] = await Promise.all([
    supabase
      .from('departments')
      .select('id, name, is_active')
      .eq('organization_id', orgId),

    supabase
      .from('job_roles')
      .select('id, title, is_active')
      .eq('organization_id', orgId),

    // Fetch only email column; relies on idx_employees_org_email
    supabase
      .from('employees')
      .select('email')
      .eq('organization_id', orgId),

    // Fetch address for work_location matching; relies on idx_organization_location_org_id
    supabase
      .from('organization_location')
      .select('id, address')
      .eq('organization_id', orgId),
  ])

  const departments = new Map<string, { id: string; is_active: boolean }>()
  for (const d of deptRes.data ?? []) {
    departments.set((d.name as string).toLowerCase(), {
      id: d.id as string,
      is_active: d.is_active as boolean,
    })
  }

  const jobRoles = new Map<string, { id: string; is_active: boolean }>()
  for (const r of roleRes.data ?? []) {
    jobRoles.set((r.title as string).toLowerCase(), {
      id: r.id as string,
      is_active: r.is_active as boolean,
    })
  }

  const existingEmails = new Set<string>()
  for (const e of emailRes.data ?? []) {
    existingEmails.add((e.email as string).toLowerCase())
  }

  const locations = new Map<string, string>()
  for (const l of locRes.data ?? []) {
    if (l.address) {
      locations.set((l.address as string).toLowerCase(), l.id as string)
    }
  }

  return { departments, jobRoles, existingEmails, locations }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) {
      return NextResponse.json(
        { error: 'Organization not found for this user' },
        { status: 403 }
      )
    }
    const orgId = profile.organization_id as string

    // ── File extraction ───────────────────────────────────────────────────────
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { error: 'Request must be multipart/form-data' },
        { status: 400 }
      )
    }

    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Missing required field: "file"' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum allowed size is ${MAX_FILE_SIZE / 1024 / 1024} MB` },
        { status: 413 }
      )
    }

    const fileName = file.name.toLowerCase()
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
    const isCsv = fileName.endsWith('.csv')

    if (!isExcel && !isCsv) {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload a .csv or .xlsx file' },
        { status: 415 }
      )
    }

    // ── Parse file ────────────────────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer()
    let rows: ParsedBulkRow[]

    if (isCsv) {
      const text = Buffer.from(arrayBuffer).toString('utf-8')
      rows = parseCsv(text)
    } else {
      rows = await parseExcel(Buffer.from(arrayBuffer))
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'File contains no data rows. Ensure the first row is the header.' },
        { status: 422 }
      )
    }

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        {
          error: `File contains ${rows.length} rows. Maximum allowed per upload is ${MAX_ROWS}. Split the file and upload in batches.`,
        },
        { status: 422 }
      )
    }

    // ── Batch-load org reference data (4 queries in parallel) ─────────────────
    const ctx = await loadOrgContext(supabase, orgId)

    // ── Validate all rows ─────────────────────────────────────────────────────
    const fileEmails = new Set<string>()
    const previewData: PreviewRow[] = rows.map((row, index) => {
      const rowNumber = index + 2 // +2 because row 1 is the header
      const errors = validateRow(row, rowNumber, ctx, fileEmails)

      // Register email for intra-file dedup (only if it's non-empty and format is valid)
      const email = row.email.trim().toLowerCase()
      if (email && EMAIL_REGEX.test(email)) {
        fileEmails.add(email)
      }

      return {
        row_number: rowNumber,
        data: row,
        status: errors.length === 0 ? 'valid' : 'invalid',
        error_message: errors.length > 0 ? errors.join('; ') : null,
      }
    })

    const validRows = previewData.filter((r) => r.status === 'valid').length

    const response: PreviewResponse = {
      total_rows: rows.length,
      valid_rows: validRows,
      invalid_rows: rows.length - validRows,
      preview_data: previewData,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (err) {
    console.error('[bulk-upload preview]', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing the file' },
      { status: 500 }
    )
  }
}
