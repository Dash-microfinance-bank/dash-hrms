import type { ParsedBulkRow } from './bulk-upload-template'
import { BULK_UPLOAD_TEMPLATE_HEADERS } from './bulk-upload-template'
import * as XLSX from 'xlsx'

function normalizeHeaderKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
}

/** Parse CSV text into rows of key-value objects. First row = headers. */
export function parseCsvToRows(text: string): ParsedBulkRow[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += c
      }
    } else {
      if (c === '"') {
        inQuotes = true
      } else if (c === ',') {
        row.push(cell)
        cell = ''
      } else if (c === '\n' || c === '\r') {
        row.push(cell)
        cell = ''
        if (c === '\r' && text[i + 1] === '\n') i++
        rows.push(row)
        row = []
      } else {
        cell += c
      }
    }
  }
  row.push(cell)
  if (row.some((c) => c.length > 0)) rows.push(row)

  if (rows.length < 2) return []
  const headerRow = rows[0].map((h) => normalizeHeaderKey(h))
  const dataRows = rows.slice(1)
  const result: ParsedBulkRow[] = []
  for (const dataRow of dataRows) {
    const obj: Record<string, string> = {}
    for (let j = 0; j < headerRow.length; j++) {
      obj[headerRow[j]] = dataRow[j] ?? ''
    }
    const rowObj: Partial<ParsedBulkRow> = {}
    for (const key of BULK_UPLOAD_TEMPLATE_HEADERS) {
      rowObj[key] = obj[key] ?? obj[key.replace(/_/g, ' ')] ?? ''
    }
    result.push(rowObj as ParsedBulkRow)
  }
  return result
}

/** Parse XLSX buffer (from SheetJS) into rows. First row = headers. */
export function parseXlsxToRows(buffer: ArrayBuffer): ParsedBulkRow[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const firstSheet = wb.Sheets[wb.SheetNames[0]]
  if (!firstSheet) return []
  const data: string[][] = XLSX.utils.sheet_to_json(firstSheet, {
    header: 1,
    defval: '',
    raw: false,
  })
  if (data.length < 2) return []
  const headerRow = data[0].map((h: unknown) =>
    normalizeHeaderKey(String(h ?? ''))
  )
  const result: ParsedBulkRow[] = []
  for (let i = 1; i < data.length; i++) {
    const dataRow = data[i] as string[]
    const obj: Record<string, string> = {}
    for (let j = 0; j < headerRow.length; j++) {
      obj[headerRow[j]] = String(dataRow[j] ?? '')
    }
    const rowObj: Partial<ParsedBulkRow> = {}
    for (const key of BULK_UPLOAD_TEMPLATE_HEADERS) {
      rowObj[key] = obj[key] ?? obj[key.replace(/_/g, ' ')] ?? ''
    }
    result.push(rowObj as ParsedBulkRow)
  }
  return result
}
