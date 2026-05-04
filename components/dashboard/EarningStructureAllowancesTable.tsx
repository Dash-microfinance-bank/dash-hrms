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
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { EarningStructureAllowanceRow } from '@/lib/data/earning-structure-detail'
import { EditStructureAllowanceModal } from '@/components/dashboard/EditStructureAllowanceModal'
import { DeleteStructureAllowanceConfirmModal } from '@/components/dashboard/DeleteStructureAllowanceConfirmModal'
import { CreateStructureAllowanceModal } from '@/components/dashboard/CreateStructureAllowanceModal'

type Props = {
  structureId: string
  rows: EarningStructureAllowanceRow[]
  allowanceOptions: Array<{
    id: string
    name: string
    calculation_type: 'FIXED' | 'PERCENTAGE' | 'FORMULA' | null
    calculation_base: 'NONE' | 'BASIC' | 'GROSS' | 'TAXABLE' | 'CUSTOM' | null
  }>
}

function formatCalculation(value: EarningStructureAllowanceRow['calculation_type']) {
  if (value === 'PERCENTAGE') return 'Percentage'
  if (value === 'FIXED') return 'Fixed'
  if (value === 'FORMULA') return 'Formula'
  return '—'
}

function formatBasedOn(value: EarningStructureAllowanceRow['calculation_base']) {
  if (value === 'BASIC') return 'Basic salary'
  if (value === 'GROSS') return 'Gross salary'
  if (value === 'TAXABLE') return 'Taxable salary'
  if (value === 'CUSTOM') return 'Custom'
  if (value === 'NONE') return 'None'
  return '—'
}

function formatValue(row: EarningStructureAllowanceRow) {
  if (row.value === null) return '—'
  if (row.calculation_type === 'PERCENTAGE') return `${row.value}%`
  if (row.calculation_type === 'FIXED') {
    return `₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 }).format(row.value)}`
  }

  return new Intl.NumberFormat('en-NG', {
    maximumFractionDigits: 2,
  }).format(row.value)
}

export function EarningStructureAllowancesTable({ structureId, rows, allowanceOptions }: Props) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([{ id: 'allowance', desc: false }])
  const [globalFilter, setGlobalFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<EarningStructureAllowanceRow | null>(null)
  const [deletingRow, setDeletingRow] = useState<EarningStructureAllowanceRow | null>(null)

  const columns = useMemo<ColumnDef<EarningStructureAllowanceRow>[]>(
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
        id: 'allowance',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-2 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Allowance
            {column.getIsSorted() === 'asc' ? (
              <ArrowUpIcon className="ml-2 size-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDownIcon className="ml-2 size-4" />
            ) : (
              <ArrowUpDownIcon className="ml-2 size-4 opacity-50" />
            )}
          </Button>
        ),
        accessorFn: (row) => row.allowance_name,
        cell: ({ row }) => <span className="font-medium">{row.original.allowance_name}</span>,
      },
      {
        id: 'calculation',
        header: 'Calculation',
        accessorFn: (row) => row.calculation_type ?? '',
        cell: ({ row }) => formatCalculation(row.original.calculation_type),
      },
      {
        id: 'based_on',
        header: 'Based on',
        accessorFn: (row) => row.calculation_base ?? '',
        cell: ({ row }) => formatBasedOn(row.original.calculation_base),
      },
      {
        id: 'value',
        header: 'Value',
        accessorFn: (row) => row.value ?? -1,
        cell: ({ row }) => formatValue(row.original),
      },
      {
        id: 'action',
        header: 'Action',
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
              <DropdownMenuItem onClick={() => setEditingRow(row.original)}>Edit</DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeletingRow(row.original)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    []
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
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  const tableRows = table.getRowModel().rows
  const isEmpty = rows.length === 0

  const handleSuccess = () => {
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search allowances..."
            className="pl-8 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary!"
            value={globalFilter ?? ''}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
          />
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={allowanceOptions.length === 0}>
          Add
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
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {isEmpty ? 'No allowances in this structure yet.' : 'No allowances match your search.'}
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

      {editingRow ? (
        <EditStructureAllowanceModal
          row={editingRow}
          open={!!editingRow}
          onOpenChange={(open) => {
            if (!open) setEditingRow(null)
          }}
          onSuccess={handleSuccess}
        />
      ) : null}
      <DeleteStructureAllowanceConfirmModal
        row={deletingRow}
        open={!!deletingRow}
        onOpenChange={(open) => {
          if (!open) setDeletingRow(null)
        }}
        onSuccess={handleSuccess}
      />
      <CreateStructureAllowanceModal
        structureId={structureId}
        allowanceOptions={allowanceOptions}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
