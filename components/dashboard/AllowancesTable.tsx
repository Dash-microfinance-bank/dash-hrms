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
import type { SalaryComponentRow } from '@/lib/data/salary-components'
import { CreateAllowanceModal } from '@/components/dashboard/CreateAllowanceModal'
import { EditAllowanceModal } from '@/components/dashboard/EditAllowanceModal'
import { DeleteAllowanceConfirmModal } from '@/components/dashboard/DeleteAllowanceConfirmModal'
import { DisableAllowanceConfirmModal } from '@/components/dashboard/DisableAllowanceConfirmModal'
import { activateAllowance } from '@/lib/actions/salary-components'
import { toast } from 'sonner'

type AllowancesTableProps = {
  data: SalaryComponentRow[]
}

export function AllowancesTable({ data }: AllowancesTableProps) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editingAllowance, setEditingAllowance] = useState<SalaryComponentRow | null>(null)
  const [deletingAllowance, setDeletingAllowance] = useState<SalaryComponentRow | null>(null)
  const [disablingAllowance, setDisablingAllowance] = useState<SalaryComponentRow | null>(null)

  const handleActivate = useCallback(async (allowance: SalaryComponentRow) => {
    const result = await activateAllowance(allowance.id)
    if (result.success) {
      toast.success('Allowance activated')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }, [router])

  const columns = useMemo<ColumnDef<SalaryComponentRow>[]>(
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
        accessorFn: (row) => row.name ?? '',
        cell: ({ row }) => <span className="font-medium">{row.original.name ?? '—'}</span>,
      },
      {
        id: 'code',
        header: 'Code',
        accessorFn: (row) => row.code ?? '',
        cell: ({ row }) => row.original.code ?? '—',
      },
      {
        id: 'calculation',
        header: 'Calculation',
        accessorFn: (row) => row.calculation_type ?? '',
        cell: ({ row }) => (row.original.calculation_type ?? '').toLowerCase() || '—',
      },
      {
        id: 'based_on',
        header: 'Based On',
        accessorFn: (row) => row.calculation_base ?? '',
        cell: ({ row }) => row.original.calculation_base ?? '—',
      },
      {
        id: 'taxable',
        header: 'Taxable',
        accessorFn: (row) => (row.is_taxable ? 'Yes' : 'No'),
        cell: ({ row }) => (row.original.is_taxable ? 'Yes' : 'No'),
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
              <DropdownMenuItem onClick={() => setEditingAllowance(row.original)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeletingAllowance(row.original)}
              >
                Delete
              </DropdownMenuItem>
              {row.original.is_active ? (
                <DropdownMenuItem onClick={() => setDisablingAllowance(row.original)}>
                  Disable
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleActivate(row.original)}>
                  Activate
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        size: 80,
      },
    ],
    [handleActivate]
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
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  const rows = table.getRowModel().rows
  const isEmpty = data.length === 0

  const handleCreateSuccess = () => {
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
        <Button onClick={() => setCreateOpen(true)}>Create</Button>
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
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  {isEmpty ? 'No allowances found.' : 'No allowances match your search.'}
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

      <CreateAllowanceModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleCreateSuccess}
      />
      {editingAllowance ? (
        <EditAllowanceModal
          allowance={editingAllowance}
          open={!!editingAllowance}
          onOpenChange={(open) => {
            if (!open) setEditingAllowance(null)
          }}
          onSuccess={handleCreateSuccess}
        />
      ) : null}
      <DeleteAllowanceConfirmModal
        allowance={deletingAllowance}
        open={!!deletingAllowance}
        onOpenChange={(open) => {
          if (!open) setDeletingAllowance(null)
        }}
        onSuccess={handleCreateSuccess}
      />
      <DisableAllowanceConfirmModal
        allowance={disablingAllowance}
        open={!!disablingAllowance}
        onOpenChange={(open) => {
          if (!open) setDisablingAllowance(null)
        }}
        onSuccess={handleCreateSuccess}
      />
    </div>
  )
}
