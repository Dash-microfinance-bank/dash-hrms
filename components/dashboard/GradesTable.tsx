'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  MoreHorizontalIcon,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import type { GradeRow } from '@/lib/data/grades'
import { CreateGradeModal } from '@/components/dashboard/CreateGradeModal'
import { EditGradeModal } from '@/components/dashboard/EditGradeModal'
import { DeleteGradeConfirmModal } from '@/components/dashboard/DeleteGradeConfirmModal'

type GradesTableProps = {
  data: GradeRow[]
}

function formatAmount(value: string | null): string | null {
  if (!value) return null
  const num = Number(value)
  if (Number.isNaN(num)) return null
  return num.toLocaleString('en-NG', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })
}

export function GradesTable({ data }: GradesTableProps) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingGrade, setEditingGrade] = useState<GradeRow | null>(null)
  const [deletingGrade, setDeletingGrade] = useState<GradeRow | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const columns = useMemo<ColumnDef<GradeRow>[]>(
    () => [
      {
        id: 'sn',
        header: 'S/N',
        cell: ({ row }) => row.index + 1,
        size: 60,
        enableSorting: false,
      },
      {
        id: 'name',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-2 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Name
            {column.getIsSorted() === 'asc' ? (
              <ArrowUpIcon className="ml-2 size-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDownIcon className="ml-2 size-4" />
            ) : (
              <ArrowUpDownIcon className="ml-2 size-4 opacity-50" />
            )}
          </Button>
        ),
        accessorFn: (row) => {
          const base = row.name
          const code = row.code?.trim()
          return code && code.length > 0 ? `${base} (${code})` : base
        },
        cell: ({ row }) => {
          const { name, code } = row.original
          const trimmedCode = code?.trim()
          const display =
            trimmedCode && trimmedCode.length > 0 ? `${name} (${trimmedCode})` : name
          return <span className="font-medium">{display}</span>
        },
      },
      {
        id: 'level',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-2 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Level
            {column.getIsSorted() === 'asc' ? (
              <ArrowUpIcon className="ml-2 size-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDownIcon className="ml-2 size-4" />
            ) : (
              <ArrowUpDownIcon className="ml-2 size-4 opacity-50" />
            )}
          </Button>
        ),
        accessorFn: (row) => row.level ?? Number.MAX_SAFE_INTEGER,
        cell: ({ row }) =>
          row.original.level !== null && row.original.level !== undefined ? (
            <span>{row.original.level}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'salary_range',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-2 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Salary (Range)
            {column.getIsSorted() === 'asc' ? (
              <ArrowUpIcon className="ml-2 size-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDownIcon className="ml-2 size-4" />
            ) : (
              <ArrowUpDownIcon className="ml-2 size-4 opacity-50" />
            )}
          </Button>
        ),
        accessorFn: (row) => {
          const min = row.min_salary ? Number(row.min_salary) : NaN
          const max = row.max_salary ? Number(row.max_salary) : NaN
          if (!Number.isNaN(min)) return min
          if (!Number.isNaN(max)) return max
          return Number.MAX_SAFE_INTEGER
        },
        sortingFn: (rowA, rowB) => {
          const a = rowA.getValue<number>('salary_range')
          const b = rowB.getValue<number>('salary_range')
          return a - b
        },
        cell: ({ row }) => {
          const currency = row.original.currency || 'NGN'
          const min = formatAmount(row.original.min_salary)
          const max = formatAmount(row.original.max_salary)

          if (!min && !max) {
            return <span className="text-muted-foreground">—</span>
          }

          if (min && max) {
            return (
              <span>
                {currency}
                {min} - {currency}
                {max}
              </span>
            )
          }

          if (min) {
            return (
              <span>
                From {currency}
                {min}
              </span>
            )
          }

          return (
            <span>
              Up to {currency}
              {max}
            </span>
          )
        },
      },
      {
        id: 'created_at',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-2 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Created
            {column.getIsSorted() === 'asc' ? (
              <ArrowUpIcon className="ml-2 size-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDownIcon className="ml-2 size-4" />
            ) : (
              <ArrowUpDownIcon className="ml-2 size-4 opacity-50" />
            )}
          </Button>
        ),
        accessorFn: (row) => row.created_at,
        sortingFn: (rowA, rowB) => {
          const a = new Date(rowA.original.created_at).getTime()
          const b = new Date(rowB.original.created_at).getTime()
          return a - b
        },
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {new Date(row.original.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontalIcon className="size-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditingGrade(row.original)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeletingGrade(row.original)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        size: 80,
      },
    ],
    []
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const rows = table.getRowModel().rows
  const isEmpty = data.length === 0

  const handleSuccess = () => {
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search grades..."
              className="pl-8 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary!"
              value={globalFilter ?? ''}
              onChange={(event) => table.setGlobalFilter(event.target.value)}
            />
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>New grade</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} style={{ width: header.getSize() }}>
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
                <TableCell colSpan={6} className="h-32 text-center align-middle">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {isEmpty
                        ? 'No grades found for this organization.'
                        : 'No grades match your search.'}
                    </p>
                    {isEmpty && (
                      <Button size="sm" onClick={() => setCreateOpen(true)}>
                        Create your first grade
                      </Button>
                    )}
                  </div>
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

      {rows.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {rows.length} of {data.length} grades
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <CreateGradeModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleSuccess}
      />

      {editingGrade && (
        <EditGradeModal
          grade={editingGrade}
          open={!!editingGrade}
          onOpenChange={(open) => {
            if (!open) {
              setEditingGrade(null)
            }
          }}
          onSuccess={handleSuccess}
        />
      )}

      <DeleteGradeConfirmModal
        grade={deletingGrade}
        open={!!deletingGrade}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingGrade(null)
          }
        }}
        onSuccess={handleSuccess}
      />
    </div>
  )
}

