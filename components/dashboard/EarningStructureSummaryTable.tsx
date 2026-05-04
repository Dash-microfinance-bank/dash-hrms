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
import type {
  EarningStructureLevelOption,
  EarningStructureSummaryRow,
} from '@/lib/data/earning-structure-summary'
import { CreateEarningStructureSummaryModal } from '@/components/dashboard/CreateEarningStructureSummaryModal'
import { EditEarningStructureSummaryModal } from '@/components/dashboard/EditEarningStructureSummaryModal'
import { DisableEarningStructureSummaryConfirmModal } from '@/components/dashboard/DisableEarningStructureSummaryConfirmModal'
import { DeleteEarningStructureSummaryConfirmModal } from '@/components/dashboard/DeleteEarningStructureSummaryConfirmModal'

type Props = {
  rows: EarningStructureSummaryRow[]
  levels: EarningStructureLevelOption[]
}

export function EarningStructureSummaryTable({ rows, levels }: Props) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<EarningStructureSummaryRow | null>(null)
  const [disablingRow, setDisablingRow] = useState<EarningStructureSummaryRow | null>(null)
  const [deletingRow, setDeletingRow] = useState<EarningStructureSummaryRow | null>(null)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_at', desc: true }])
  const [globalFilter, setGlobalFilter] = useState('')

  const columns = useMemo<ColumnDef<EarningStructureSummaryRow>[]>(
    () => [
      {
        id: 'sn',
        header: 'S/N',
        cell: ({ row, table }) => {
          const { pageIndex, pageSize } = table.getState().pagination
          const position = table.getRowModel().rows.findIndex((r) => r.id === row.id)
          return pageIndex * pageSize + position + 1
        },
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
        accessorFn: (row) => row.structure_name,
        cell: ({ row }) => <span className="font-medium">{row.original.structure_name}</span>,
      },
      {
        id: 'level',
        header: 'Level',
        accessorFn: (row) => row.level_name,
        cell: ({ row }) => row.original.level_name,
      },
      {
        id: 'allowances',
        header: 'Allowances',
        accessorFn: (row) => row.allowances_count,
        cell: ({ row }) => row.original.allowances_count,
      },
      {
        id: 'employees',
        header: 'Employees',
        accessorFn: (row) => row.employees_count,
        cell: ({ row }) => row.original.employees_count,
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (row) => row.status,
        cell: ({ row }) => (
          <span className={row.original.status === 'active' ? 'text-emerald-600' : 'text-muted-foreground'}>
            {row.original.status === 'active' ? 'Active' : 'Disabled'}
          </span>
        ),
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
        id: 'action',
        header: 'Action',
        enableSorting: false,
        cell: ({ row }) => {
          const isDefaultStructure = row.original.level_id === null
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontalIcon className="size-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    router.push(
                      `/dashboard/admin/payroll/earning-structure/${row.original.structure_id}`
                    )
                  }}
                >
                  {/* <EyeIcon className="mr-2 size-4" /> */}
                  View allowances
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setEditingRow(row.original)}
                  disabled={isDefaultStructure}
                >
                  Edit structure
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDisablingRow(row.original)}
                  disabled={isDefaultStructure || row.original.status === 'disabled'}
                >
                  Disable structure
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeletingRow(row.original)}
                  disabled={isDefaultStructure}
                >
                  Delete structure
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [router]
  )

  const table = useReactTable({
    data: rows,
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

  const tableRows = table.getRowModel().rows
  const isEmpty = rows.length === 0

  const assignedLevelIds = new Set(
    rows
      .map((r) => r.level_id)
      .filter((v): v is string => v !== null)
  )

  const hasDefaultStructure = rows.some((r) => r.level_id === null)

  const selectableLevelsForCreate = levels.filter((level) => {
    if (level.id === null) return !hasDefaultStructure
    return !assignedLevelIds.has(level.id)
  })

  const selectableLevelsForEdit = (row: EarningStructureSummaryRow) =>
    levels.filter((level) => {
      if (level.id === null) return row.level_id === null || !hasDefaultStructure
      return level.id === row.level_id || !assignedLevelIds.has(level.id)
    })

  const handleSuccess = () => {
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search structures..."
            className="pl-8 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary!"
            value={globalFilter ?? ''}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
          />
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={selectableLevelsForCreate.length === 0}>
          Create
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
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
            {tableRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center align-middle">
                  <p className="text-sm text-muted-foreground">
                    {isEmpty ? 'No structures found.' : 'No structures match your search.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              tableRows.map((row) => (
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

      {tableRows.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {tableRows.length} of {rows.length} structures
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

      <CreateEarningStructureSummaryModal
        levels={selectableLevelsForCreate}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleSuccess}
      />
      {editingRow ? (
        <EditEarningStructureSummaryModal
          row={editingRow}
          selectableLevels={selectableLevelsForEdit(editingRow)}
          open={!!editingRow}
          onOpenChange={(open) => {
            if (!open) setEditingRow(null)
          }}
          onSuccess={handleSuccess}
        />
      ) : null}
      <DisableEarningStructureSummaryConfirmModal
        row={disablingRow}
        open={!!disablingRow}
        onOpenChange={(open) => {
          if (!open) setDisablingRow(null)
        }}
        onSuccess={handleSuccess}
      />
      <DeleteEarningStructureSummaryConfirmModal
        row={deletingRow}
        open={!!deletingRow}
        onOpenChange={(open) => {
          if (!open) setDeletingRow(null)
        }}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
