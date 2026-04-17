'use client'

import React, { useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  DownloadIcon,
  EyeIcon,
  Loader2Icon,
  SearchIcon,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { AdminDocumentRow } from '@/lib/data/admin-documents'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isExpiringSoon(iso: string | null | undefined): boolean {
  if (!iso) return false
  const diff = new Date(iso).getTime() - Date.now()
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000 // within 30 days
}

function isExpired(iso: string | null | undefined): boolean {
  if (!iso) return false
  return new Date(iso).getTime() < Date.now()
}

// ─── Sortable header helper ────────────────────────────────────────────────────

function SortableHeader({
  label,
  column,
}: {
  label: string
  column: { toggleSorting: (asc: boolean) => void; getIsSorted: () => false | 'asc' | 'desc' }
}) {
  return (
    <Button
      variant="ghost"
      className="-ml-2 h-8 data-[state=open]:bg-accent"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {label}
      {column.getIsSorted() === 'asc' ? (
        <ArrowUpIcon className="ml-2 size-3.5" />
      ) : column.getIsSorted() === 'desc' ? (
        <ArrowDownIcon className="ml-2 size-3.5" />
      ) : (
        <ArrowUpDownIcon className="ml-2 size-3.5 opacity-50" />
      )}
    </Button>
  )
}

// ─── Download action cell ──────────────────────────────────────────────────────

function DownloadButton({ row }: { row: AdminDocumentRow }) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    if (!row.employeeId || !row.id) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/employees/${row.employeeId}/documents/${row.id}/download?format=json`
      )
      if (!res.ok) throw new Error('Failed to get download link')
      const { signedUrl, fileName } = (await res.json()) as {
        signedUrl: string
        fileName: string
      }
      try {
        const blob = await fetch(signedUrl).then((r) => r.blob())
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName ?? row.fileName ?? 'document'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      } catch {
        window.open(signedUrl, '_blank')
      }
    } catch {
      toast.error('Download failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!row.employeeId) return null

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      onClick={handleDownload}
      disabled={loading}
      title="Download"
    >
      {loading ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <DownloadIcon className="size-4" />
      )}
      <span className="sr-only">Download</span>
    </Button>
  )
}

// ─── Table component ───────────────────────────────────────────────────────────

type DocumentsTableProps = {
  data: AdminDocumentRow[]
}

export function DocumentsTable({ data }: DocumentsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'title', desc: false },
  ])
  const [globalFilter, setGlobalFilter] = useState('')

  const columns = useMemo<ColumnDef<AdminDocumentRow>[]>(
    () => [
      // ── 1. S/N ──────────────────────────────────────────────────────────────
      {
        id: 'sn',
        header: 'S/N',
        enableSorting: false,
        size: 56,
        cell: ({ row, table }) => {
          // row.index reflects the original data-array position, so it jumps
          // around when the table is sorted or filtered.  Instead derive the
          // visual position from the current page's rendered rows, which are
          // already sorted and filtered.
          const { pageIndex, pageSize } = table.getState().pagination
          const pageRows = table.getRowModel().rows
          const position = pageRows.findIndex((r) => r.id === row.id)
          return (
            <span className="text-muted-foreground tabular-nums">
              {pageIndex * pageSize + position + 1}
            </span>
          )
        },
      },

      // ── 2. Title ─────────────────────────────────────────────────────────────
      {
        id: 'title',
        header: ({ column }) => <SortableHeader label="Title" column={column} />,
        accessorFn: (row) => row.title,
        cell: ({ row }) => (
          <span className="font-medium leading-snug">{row.original.title}</span>
        ),
      },

      // ── 3. Document type ──────────────────────────────────────────────────────
      {
        id: 'documentType',
        header: ({ column }) => <SortableHeader label="Document Type" column={column} />,
        accessorFn: (row) => row.documentTypeName,
        cell: ({ row }) => (
          <span className="text-sm">{row.original.documentTypeName}</span>
        ),
      },

      // ── 4. Document category ──────────────────────────────────────────────────
      {
        id: 'category',
        header: ({ column }) => <SortableHeader label="Category" column={column} />,
        accessorFn: (row) => row.documentCategoryName ?? '',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.documentCategoryName ?? '—'}
          </span>
        ),
      },

      // ── 5. Owner ──────────────────────────────────────────────────────────────
      {
        id: 'owner',
        header: ({ column }) => <SortableHeader label="Owner" column={column} />,
        // Searchable on both the display name and email.
        accessorFn: (row) =>
          [row.forLabel, row.employeeEmail].filter(Boolean).join(' '),
        cell: ({ row }) => {
          const r = row.original

          // Badge label + colour per owner type.
          const badge =
            r.ownerType === 'USER'
              ? { label: 'Employee', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' }
              : r.ownerType === 'DEPARTMENT'
              ? { label: 'Department', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' }
              : { label: 'Company', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' }

          return (
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>
              {/* <p className="truncate text-sm font-medium leading-snug">{r.forLabel}</p> */}
              {/* {r.ownerType === 'USER' && r.employeeEmail && r.employeeEmail !== r.forLabel ? (
                <p className="truncate text-xs text-muted-foreground">{r.employeeEmail}</p>
              ) : null} */}
            </div>
          )
        },
      },

      // ── 6. Expiry date ────────────────────────────────────────────────────────
      {
        id: 'expiryDate',
        header: ({ column }) => <SortableHeader label="Expiry Date" column={column} />,
        accessorFn: (row) => row.expiryDate ?? '',
        sortingFn: (a, b) => {
          // Null / empty dates sort to the end regardless of direction.
          const aMs = a.original.expiryDate ? new Date(a.original.expiryDate).getTime() : Infinity
          const bMs = b.original.expiryDate ? new Date(b.original.expiryDate).getTime() : Infinity
          return aMs - bMs
        },
        cell: ({ row }) => {
          const d = row.original.expiryDate
          if (!d) return <span className="text-sm text-muted-foreground">—</span>
          const expired = isExpired(d)
          const soon = !expired && isExpiringSoon(d)
          return (
            <div className="flex flex-col gap-0.5">
              <span
                className={
                  expired
                    ? 'text-sm font-medium text-destructive'
                    : soon
                    ? 'text-sm font-medium text-amber-600'
                    : 'text-sm text-muted-foreground'
                }
              >
                {formatShortDate(d)}
              </span>
              {(expired || soon) && (
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide ${
                    expired ? 'text-destructive' : 'text-amber-600'
                  }`}
                >
                  {expired ? 'Expired' : 'Expiring soon'}
                </span>
              )}
            </div>
          )
        },
      },

      // ── 7. Actions ────────────────────────────────────────────────────────────
      {
        id: 'actions',
        header: 'Action',
        enableSorting: false,
        size: 96,
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className="flex items-center gap-1">
              {r.fileUrl ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  asChild
                  title="View file"
                >
                  <a href={r.fileUrl} target="_blank" rel="noopener noreferrer">
                    <EyeIcon className="size-4" />
                    <span className="sr-only">View</span>
                  </a>
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled
                  title="No file attached"
                >
                  <EyeIcon className="size-4 opacity-40" />
                  <span className="sr-only">No file</span>
                </Button>
              )}
              <DownloadButton row={r} />
            </div>
          )
        },
      },
    ],
    []
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  })

  const rows = table.getRowModel().rows
  const isEmpty = data.length === 0
  const filtered = table.getFilteredRowModel().rows.length
  const { pageIndex, pageSize } = table.getState().pagination
  const pageStart = pageIndex * pageSize + 1
  const pageEnd = Math.min(pageStart + rows.length - 1, filtered)

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, employee, type…"
            className="pl-8 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary!"
            value={globalFilter ?? ''}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.column.getSize() !== 150 ? header.column.getSize() : undefined }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-36 text-center align-middle">
                  <p className="text-sm text-muted-foreground">
                    {isEmpty
                      ? 'No approved documents yet.'
                      : 'No documents match your search.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {filtered > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {rows.length > 0
              ? `Showing ${pageStart}–${pageEnd} of ${filtered} document${filtered === 1 ? '' : 's'}`
              : `${filtered} document${filtered === 1 ? '' : 's'}`}
            {filtered < data.length ? ` (filtered from ${data.length})` : ''}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.firstPage()}
              disabled={!table.getCanPreviousPage()}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              Page {pageIndex + 1} / {table.getPageCount()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.lastPage()}
              disabled={!table.getCanNextPage()}
            >
              Last
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
