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
import type { PayGroupRow } from '@/lib/data/pay-groups'
import { CreatePayGroupModal } from '@/components/dashboard/CreatePayGroupModal'
import { EditPayGroupModal } from '@/components/dashboard/EditPayGroupModal'
import { DeletePayGroupConfirmModal } from '@/components/dashboard/DeletePayGroupConfirmModal'
import { DisablePayGroupConfirmModal } from '@/components/dashboard/DisablePayGroupConfirmModal'
import { activatePayGroup } from '@/lib/actions/pay-groups'
import { toast } from 'sonner'

type PayGroupsTableProps = {
  data: PayGroupRow[]
}

const weekdaysMon1Sun7 = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`
  const rem = day % 10
  if (rem === 1) return `${day}st`
  if (rem === 2) return `${day}nd`
  if (rem === 3) return `${day}rd`
  return `${day}th`
}

function formatFrequency(value: PayGroupRow['pay_frequency']): string {
  switch (value) {
    case 'DAILY':
      return 'daily'
    case 'WEEKLY':
      return 'weekly'
    case 'BI_WEEKLY':
      return 'bi-weekly'
    case 'MONTHLY':
      return 'monthly'
    default:
      return '—'
  }
}

function formatPayDay(row: PayGroupRow): string {
  if (row.pay_day_type === 'LAST_WORKING_DAY') return 'Last working day'

  if (row.pay_frequency === 'MONTHLY' && row.pay_day && row.pay_day >= 1 && row.pay_day <= 31) {
    return `${ordinalSuffix(row.pay_day)} (monthly)`
  }

  if (
    (row.pay_frequency === 'WEEKLY' || row.pay_frequency === 'BI_WEEKLY') &&
    row.pay_day &&
    row.pay_day >= 1 &&
    row.pay_day <= 7
  ) {
    const name = weekdaysMon1Sun7[row.pay_day - 1]
    if (row.pay_frequency === 'BI_WEEKLY' && row.anchor_date) {
      return `${name} (${row.anchor_date})`
    }
    return name
  }

  return '—'
}

export function PayGroupsTable({ data }: PayGroupsTableProps) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editingPayGroup, setEditingPayGroup] = useState<PayGroupRow | null>(null)
  const [deletingPayGroup, setDeletingPayGroup] = useState<PayGroupRow | null>(null)
  const [disablingPayGroup, setDisablingPayGroup] = useState<PayGroupRow | null>(null)

  const handleActivate = useCallback(async (payGroup: PayGroupRow) => {
    const result = await activatePayGroup(payGroup.id)
    if (result.success) {
      toast.success('Pay group activated')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }, [router])

  const columns = useMemo<ColumnDef<PayGroupRow>[]>(
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
        id: 'frequency',
        header: 'Frequency',
        accessorFn: (row) => formatFrequency(row.pay_frequency),
        cell: ({ row }) => formatFrequency(row.original.pay_frequency),
      },
      {
        id: 'pay_day',
        header: 'Pay Day',
        accessorFn: (row) => formatPayDay(row),
        cell: ({ row }) => formatPayDay(row.original),
      },
      {
        id: 'currency',
        header: 'Currency',
        accessorFn: (row) => row.currency ?? 'NGN',
        cell: ({ row }) => row.original.currency ?? 'NGN',
      },
      {
        id: 'employees',
        header: 'Employees',
        accessorFn: (row) => row.employees_count,
        cell: ({ row }) => row.original.employees_count,
      },
      {
        id: 'auto_run',
        header: 'Auto Run',
        accessorFn: (row) => (row.auto_generate_payroll ? 'Yes' : 'No'),
        cell: ({ row }) => (row.original.auto_generate_payroll ? 'Yes' : 'No'),
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (row) => (row.active ? 'Active' : 'Disabled'),
        cell: ({ row }) => (
          <span className={row.original.active ? 'text-emerald-600' : 'text-muted-foreground'}>
            {row.original.active ? 'Active' : 'Disabled'}
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
              <DropdownMenuItem onClick={() => setEditingPayGroup(row.original)}>
                Edit
              </DropdownMenuItem>
              {row.original.active ? (
                <DropdownMenuItem onClick={() => setDisablingPayGroup(row.original)}>
                  Disable
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleActivate(row.original)}>
                  Activate
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeletingPayGroup(row.original)}
              >
                Delete
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
            placeholder="Search pay groups..."
            className="pl-8 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary!"
            value={globalFilter ?? ''}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
          />
        </div>
        <Button onClick={() => setCreateOpen(true)}>Create</Button>
      </div>

      <div className="rounded-md borde overflow-x-auto">
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
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  {isEmpty ? 'No pay groups found.' : 'No pay groups match your search.'}
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

      <CreatePayGroupModal open={createOpen} onOpenChange={setCreateOpen} onSuccess={handleSuccess} />
      {editingPayGroup ? (
        <EditPayGroupModal
          payGroup={editingPayGroup}
          open={!!editingPayGroup}
          onOpenChange={(open) => {
            if (!open) setEditingPayGroup(null)
          }}
          onSuccess={handleSuccess}
        />
      ) : null}
      <DeletePayGroupConfirmModal
        payGroup={deletingPayGroup}
        open={!!deletingPayGroup}
        onOpenChange={(open) => {
          if (!open) setDeletingPayGroup(null)
        }}
        onSuccess={handleSuccess}
      />
      <DisablePayGroupConfirmModal
        payGroup={disablingPayGroup}
        open={!!disablingPayGroup}
        onOpenChange={(open) => {
          if (!open) setDisablingPayGroup(null)
        }}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
