'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
} from '@tanstack/react-table'
import { DownloadIcon, Loader2Icon, UploadIcon, XCircleIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BULK_UPLOAD_TEMPLATE_HEADERS,
  validateBulkRow,
  type ParsedBulkRow,
  type RowValidation,
} from '@/lib/bulk-upload-template'
import { parseCsvToRows, parseXlsxToRows } from '@/lib/bulk-upload-parse'
import { cn } from '@/lib/utils'

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const ACCEPT_FILES = '.csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv'

type TemplateFormat = 'csv' | 'excel'

type PreviewRow = ParsedBulkRow & {
  _rowIndex: number
  _validation: RowValidation
}

export default function BulkUploadPage() {
  const router = useRouter()

  const [templateFormat, setTemplateFormat] = useState<TemplateFormat>('csv')
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const validCount = useMemo(
    () => previewRows.filter((r) => r._validation.valid).length,
    [previewRows]
  )
  const invalidCount = previewRows.length - validCount
  const hasValidRows = validCount > 0

  const handleDownloadTemplate = useCallback(async () => {
    setDownloadLoading(true)
    try {
      const res = await fetch(
        `/api/employees/bulk-upload/template?format=${templateFormat}`
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || res.statusText)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download =
        templateFormat === 'csv'
          ? 'employee-bulk-upload-template.csv'
          : 'employee-bulk-upload-template.xlsx'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Template downloaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDownloadLoading(false)
    }
  }, [templateFormat])

  const parseFile = useCallback(async (f: File): Promise<PreviewRow[]> => {
    const buffer = await f.arrayBuffer()
    const ext = f.name.split('.').pop()?.toLowerCase()
    let rows: ParsedBulkRow[]
    if (ext === 'csv') {
      const text = new TextDecoder().decode(buffer)
      rows = parseCsvToRows(text)
    } else if (ext === 'xlsx') {
      rows = parseXlsxToRows(buffer)
    } else {
      throw new Error('Unsupported file type. Use .csv or .xlsx')
    }
    return rows.map((row, i) => ({
      ...row,
      _rowIndex: i + 1,
      _validation: validateBulkRow(row, i + 1),
    }))
  }, [])

  const handleFile = useCallback(
    async (f: File | null) => {
      if (!f) {
        setFile(null)
        setPreviewRows([])
        return
      }
      if (f.size > MAX_FILE_SIZE_BYTES) {
        toast.error('File too large. Maximum size is 5MB.')
        return
      }
      setUploadLoading(true)
      setFile(f)
      try {
        const rows = await parseFile(f)
        setPreviewRows(rows)
        const valid = rows.filter((r) => r._validation.valid).length
        toast.success(
          `Loaded ${rows.length} row(s). ${valid} valid, ${rows.length - valid} with errors.`
        )
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to parse file')
        setFile(null)
        setPreviewRows([])
      } finally {
        setUploadLoading(false)
      }
    },
    [parseFile]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)
      const f = e.dataTransfer.files?.[0]
      if (f && (f.name.endsWith('.csv') || f.name.endsWith('.xlsx'))) {
        handleFile(f)
      } else {
        toast.error('Please drop a .csv or .xlsx file')
      }
    },
    [handleFile]
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }, [])

  const onInputFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      handleFile(f ?? null)
      e.target.value = ''
    },
    [handleFile]
  )

  const handleReupload = useCallback(() => {
    setFile(null)
    setPreviewRows([])
    toast.info('Cleared. You can upload a new file.')
  }, [])

  const handleRemoveInvalid = useCallback(() => {
    setPreviewRows((prev) => prev.filter((r) => r._validation.valid))
    toast.success('Invalid rows removed')
  }, [])

  const handleConfirmImport = useCallback(async () => {
    if (!hasValidRows || !file) return

    setConfirmLoading(true)
    try {
      // Map client-side rows to the PreviewRow shape the confirm API expects.
      // We send ALL rows so the job log is a complete audit trail; the edge
      // function only processes rows whose status is 'valid'.
      const rows = previewRows.map((r) => {
        const { _rowIndex, _validation, ...data } = r
        return {
          row_number: _rowIndex,
          data,
          status: _validation.valid ? 'valid' : 'invalid',
          error_message: _validation.error ?? null,
        }
      })

      const body = new FormData()
      body.append('file', file)
      body.append('rows', JSON.stringify(rows))

      const res = await fetch('/api/employees/bulk-upload/confirm', {
        method: 'POST',
        body,
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? res.statusText)
      }

      const { job_id } = await res.json() as { job_id: string }
      toast.success('Import started! Taking you to the job status page…')
      router.push(`/dashboard/admin/employees/bulk-upload/${job_id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start import')
    } finally {
      setConfirmLoading(false)
    }
  }, [hasValidRows, file, previewRows, router])

  const columns = useMemo<ColumnDef<PreviewRow>[]>(
    () => [
      ...BULK_UPLOAD_TEMPLATE_HEADERS.map((key) => ({
        id: key,
        header: key.replace(/_/g, ' '),
        accessorKey: key as keyof PreviewRow,
        cell: ({ row }: { row: Row<PreviewRow> }) => (
          <span className="max-w-[180px] truncate block" title={String(row.original[key] ?? '')}>
            {String(row.original[key] ?? '')}
          </span>
        ),
      })),
      {
        id: 'validation_status',
        header: 'Validation Status',
        accessorFn: (row: PreviewRow) => (row._validation.valid ? 'Valid' : 'Invalid'),
        cell: ({ row }: { row: Row<PreviewRow> }) => (
          <span
            className={cn(
              'font-medium',
              row.original._validation.valid
                ? 'text-green-600 dark:text-green-400'
                : 'text-destructive'
            )}
          >
            {row.original._validation.valid ? 'Valid' : 'Invalid'}
          </span>
        ),
      },
      {
        id: 'error_message',
        header: 'Error Message',
        accessorFn: (row: PreviewRow) => row._validation.error ?? '—',
        cell: ({ row }: { row: Row<PreviewRow> }) => (
          <span className="max-w-[220px] truncate block text-muted-foreground" title={row.original._validation.error ?? ''}>
            {row.original._validation.error ?? '—'}
          </span>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: previewRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section className="space-y-6 p-4 md:p-6">
      {/* Section 1 — Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bulk Employee Upload
        </h1>
        <p className="text-muted-foreground mt-1">
          Download a template, fill in your data, then upload the file to
          preview and import employees.
        </p>
      </div>

      {/* Section 2 — Template Download */}
      <Card>
        <CardHeader>
          <CardTitle>Template Download</CardTitle>
          <CardDescription>
            Get a CSV or Excel file with the correct columns. Fill in your data
            and upload it below.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="format">Format</Label>
            <select
              id="format"
              value={templateFormat}
              onChange={(e) => setTemplateFormat(e.target.value as TemplateFormat)}
              className="h-9 w-full min-w-[120px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
            </select>
          </div>
          <Button
            onClick={handleDownloadTemplate}
            disabled={downloadLoading}
          >
            {downloadLoading ? (
              'Downloading…'
            ) : (
              <>
                <DownloadIcon className="size-4" />
                Download
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Section 3 — Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload File</CardTitle>
          <CardDescription>
            Drag and drop a .csv or .xlsx file here, or click to browse. Max size
            5MB.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50',
              uploadLoading && 'pointer-events-none opacity-60'
            )}
          >
            <input
              type="file"
              accept={ACCEPT_FILES}
              onChange={onInputFile}
              className="hidden"
              id="bulk-upload-file"
            />
            <label
              htmlFor="bulk-upload-file"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <UploadIcon className="size-10 text-muted-foreground" />
              <span className="text-sm font-medium">
                {file
                  ? file.name
                  : 'Drop your file here or click to browse'}
              </span>
              {uploadLoading && (
                <span className="text-xs text-muted-foreground">
                  Parsing file…
                </span>
              )}
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Section 4 — Preview Table */}
      {previewRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              {previewRows.length} row(s) — {validCount} valid, {invalidCount}{' '}
              invalid
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id}>
                      {hg.headers.map((h) => (
                        <TableHead key={h.id}>
                          {flexRender(
                            h.column.columnDef.header,
                            h.getContext()
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn(
                        !row.original._validation.valid &&
                          'bg-destructive/10 dark:bg-destructive/15'
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>

          {/* Section 5 — Actions */}
          <CardFooter className="flex flex-wrap gap-2 border-t pt-6">
            <Button variant="outline" onClick={handleReupload}>
              Re-upload
            </Button>
            {invalidCount > 0 && (
              <Button variant="outline" onClick={handleRemoveInvalid}>
                <XCircleIcon className="size-4" />
                Remove invalid rows
              </Button>
            )}
            <Button
              onClick={handleConfirmImport}
              disabled={!hasValidRows || confirmLoading}
              className="ml-auto gap-2"
            >
              {confirmLoading && <Loader2Icon className="size-4 animate-spin" />}
              {confirmLoading ? 'Submitting…' : `Confirm Import (${validCount})`}
            </Button>
          </CardFooter>
        </Card>
      )}
    </section>
  )
}
