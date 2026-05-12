'use client'

import React, { useCallback, useMemo, useState } from 'react'
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
import type { DeductionTableRow } from '@/lib/data/deductions'
import { CreateDeductionModal } from '@/components/dashboard/CreateDeductionModal'
import { EditDeductionModal } from '@/components/dashboard/EditDeductionModal'
import { DeleteDeductionConfirmModal } from '@/components/dashboard/DeleteDeductionConfirmModal'
import { DisableDeductionConfirmModal } from '@/components/dashboard/DisableDeductionConfirmModal'
import { activateDeduction } from '@/lib/actions/deductions'
import { toast } from 'sonner'

type DeductionsTableProps = {
  data: DeductionTableRow[]
}

function formatCalculationType(t: DeductionTableRow['calculation_type']): string {
  const v = (t ?? '').toLowerCase()
  return v || '—'
}

function formatBasedOn(base: DeductionTableRow['calculation_base']): string {
  switch (base) {
    case 'BASIC':
      return 'Base salary'
    case 'GROSS':
      return 'Gross salary'
    case 'TAXABLE':
      return 'Taxable income'
    case 'CUSTOM':
      return 'Custom'
    case 'NONE':
    default:
      return base && base !== 'NONE' ? base : '—'
  }
}

function formatValueCell(row: DeductionTableRow): string {
  if (row.calculation_type === 'FORMULA') return 'Auto'
  const v = row.payroll_value
  if (v == null) return '—'
  if (row.calculation_type === 'PERCENTAGE') return `${v}%`
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(v)
}

export function DeductionsTable({ data }: DeductionsTableProps) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<DeductionTableRow | null>(null)
  const [deleting, setDeleting] = useState<DeductionTableRow | null>(null)
  const [disabling, setDisabling] = useState<DeductionTableRow | null>(null)

  const handleActivate = useCallback(async (row: DeductionTableRow) => {
    const result = await activateDeduction(row.id)
    if (result.success) {
      toast.success('Deduction activated')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }, [router])

  const columns = useMemo<ColumnDef<DeductionTableRow>[]>(
    () => [
      {
        id: 'sn',
        header: 'S/N',
        cell: ({ row, table }) => {
          const { pageIndex, pageSize } = table.getState().pagination
          const position = table.getRowModel().rows.findIndex((r) => r.id === row.id)
          return pageIndex * pageSize + position + 1
        },
        size: 56,
        enableSorting: false,
      },
      {
        id: 'type_name',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-2 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Type
            {column.getIsSorted() === 'asc' ? (
              <ArrowUpIcon className="ml-2 size-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDownIcon className="ml-2 size-4" />
            ) : (
              <ArrowUpDownIcon className="ml-2 size-4 opacity-50" />
            )}
          </Button>
        ),
        accessorFn: (row) => row.name ?? '',
        cell: ({ row }) => <span className="font-medium">{row.original.name ?? '—'}</span>,
      },
      {
        id: 'calculation',
        header: 'Calculation',
        accessorFn: (row) => formatCalculationType(row.calculation_type),
        cell: ({ row }) => formatCalculationType(row.original.calculation_type),
      },
      {
        id: 'based_on',
        header: 'Based on',
        accessorFn: (row) => formatBasedOn(row.calculation_base),
        cell: ({ row }) => formatBasedOn(row.original.calculation_base),
      },
      {
        id: 'value',
        header: 'Value',
        accessorFn: (row) => formatValueCell(row),
        cell: ({ row }) => formatValueCell(row.original),
      },
      {
        id: 'reduces_taxable',
        header: 'Reduces taxable',
        accessorFn: (row) => (row.reduces_taxable_income ? 'Yes' : 'No'),
        cell: ({ row }) => (row.original.reduces_taxable_income ? 'Yes' : 'No'),
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (row) => (row.is_active ? 'Active' : 'Disabled'),
        cell: ({ row }) => (
          <span className={row.original.is_active ? 'text-emerald-600' : 'text-muted-foreground'}>
            {row.original.is_active ? 'Active' : 'Disabled'}
          </span>
        ),
      },
      {
        id: 'actions',
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
              <DropdownMenuItem onClick={() => setEditing(row.original)}>Edit deduction</DropdownMenuItem>
              {row.original.is_active ? (
                <DropdownMenuItem onClick={() => setDisabling(row.original)}>
                  Disable deduction
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleActivate(row.original)}>
                  Activate deduction
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleting(row.original)}
              >
                Delete deduction
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        size: 72,
      },
    ],
    [handleActivate]
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
    initialState: { pagination: { pageSize: 10 } },
  })

  const rows = table.getRowModel().rows
  const isEmpty = data.length === 0
  const handleSuccess = () => router.refresh()

  return (
    <div className="space-y-4 bg-card py-3 px-3 rounded-md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search deductions..."
            className="pl-8 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary!"
            value={globalFilter ?? ''}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
          />
        </div>
        <Button onClick={() => setCreateOpen(true)}>Create</Button>
      </div>

      <div className="rounded-md overflow-x-auto">
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
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  {isEmpty ? 'No deductions found.' : 'No deductions match your search.'}
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

      <CreateDeductionModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleSuccess}
        existingDeductions={data}
      />
      {editing ? (
        <EditDeductionModal
          deduction={editing}
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          onSuccess={handleSuccess}
          existingDeductions={data}
        />
      ) : null}
      <DeleteDeductionConfirmModal
        deduction={deleting}
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        onSuccess={handleSuccess}
      />
      <DisableDeductionConfirmModal
        deduction={disabling}
        open={!!disabling}
        onOpenChange={(open) => {
          if (!open) setDisabling(null)
        }}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
