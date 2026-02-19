import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

// Force Node.js runtime — ExcelJS uses Node streams/Buffer, and the Supabase
// auth HTTP call times out inside the Edge Runtime sandbox.
export const runtime = 'nodejs'

/** Template column headers (business contract) */
const TEMPLATE_HEADERS = [
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

export type BulkUploadTemplateHeader = (typeof TEMPLATE_HEADERS)[number]

/** One example row for the template */
const EXAMPLE_ROW: Record<BulkUploadTemplateHeader, string> = {
  staff_id: 'EMP001',
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane.doe@example.com',
  phone_number: '+2348012345678',
  gender: 'female',
  contract_type: 'permanent',
  employment_status: 'confirmed',
  start_date: '2024-01-15',
  end_date: '',
  department: 'Engineering',
  job_role: 'Software Engineer',
  work_location: 'Lagos HQ',
}

const FILENAME_CSV = 'employee-bulk-upload-template.csv'
const FILENAME_EXCEL = 'employee-bulk-upload-template.xlsx'

export type TemplateFormat = 'csv' | 'excel'

function escapeCsvValue(value: string): string {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCsvBuffer(): Buffer {
  const headerLine = TEMPLATE_HEADERS.map(escapeCsvValue).join(',')
  const exampleLine = TEMPLATE_HEADERS.map((h) => escapeCsvValue(EXAMPLE_ROW[h])).join(',')
  const body = [headerLine, exampleLine].join('\r\n')
  return Buffer.from(body, 'utf-8')
}

async function buildExcelBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Dash HRM'
  const sheet = workbook.addWorksheet('Employees')

  sheet.columns = TEMPLATE_HEADERS.map((key) => ({
    header: key,
    key,
    width: key === 'email' || key === 'work_location' ? 28 : 18,
  }))

  sheet.addRow(EXAMPLE_ROW)

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as ArrayBuffer)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Template is org-agnostic (headers + sample row only) — no org lookup needed.
    const { searchParams } = new URL(request.url)
    const format = (searchParams.get('format') ?? 'csv').toLowerCase() as TemplateFormat

    if (format !== 'csv' && format !== 'excel') {
      return NextResponse.json(
        { error: 'Invalid format. Use format=csv or format=excel' },
        { status: 400 }
      )
    }

    if (format === 'csv') {
      const buffer = buildCsvBuffer()
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${FILENAME_CSV}"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const buffer = await buildExcelBuffer()
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${FILENAME_EXCEL}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[bulk-upload template]', err)
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    )
  }
}
