'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from '@tanstack/react-table'
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlayIcon,
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { PayGroupRow } from '@/lib/data/pay-groups'
import type { PayrollRunRow, PayrollRunStatus } from '@/lib/data/payroll-runs'
import { RunPayrollModal } from '@/components/dashboard/RunPayrollModal'

type PayrollRunsTableProps = {
  data: PayrollRunRow[]
  payGroups: PayGroupRow[]
}

const STATUS_OPTIONS: { value: PayrollRunStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'LOCKED', label: 'Locked' },
  { value: 'PAID', label: 'Paid' },
]

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const PAGE_SIZES = [10, 20, 50]
const ALL_YEARS = '__all__'

function formatPayPeriod(row: PayrollRunRow): string {
  const monthName = MONTH_NAMES[row.month - 1] ?? `M${row.month}`
  const base = `${monthName}, ${row.year}`
  if (row.period == null) return base
  if (row.pay_frequency === 'WEEKLY') return `${base} - Week ${row.period}`
  if (row.pay_frequency === 'BI_WEEKLY') {
    return `${base} - ${row.period === 1 ? '1st Half' : '2nd Half'}`
  }
  return base
}

function statusPillClass(status: PayrollRunStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'bg-muted text-muted-foreground'
    case 'APPROVED':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
    case 'LOCKED':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
    case 'PAID':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function statusLabel(status: PayrollRunStatus): string {
  return STATUS_OPTIONS.find((opt) => opt.value === status)?.label ?? status
}

const INITIALIZED_PILL_CLASS = 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300'

function hasPayrollEntries(row: PayrollRunRow): boolean {
  return row.entry_count > 0
}

function employeesDisplay(row: PayrollRunRow): string {
  if (!hasPayrollEntries(row) || row.total_employees === 0) return 'Not yet'
  return String(row.total_employees)
}

export function PayrollRunsTable({ data, payGroups }: PayrollRunsTableProps) {
  const [runPayrollOpen, setRunPayrollOpen] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const yearOptions = useMemo(
    () => Array.from(new Set(data.map((row) => row.year))).sort((a, b) => b - a),
    [data]
  )

  const columns = useMemo<ColumnDef<PayrollRunRow>[]>(
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
        enableGlobalFilter: false,
      },
      {
        id: 'pay_group',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-2 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Pay group
            {column.getIsSorted() === 'asc' ? (
              <ArrowUpIcon className="ml-2 size-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDownIcon className="ml-2 size-4" />
            ) : (
              <ArrowUpDownIcon className="ml-2 size-4 opacity-50" />
            )}
          </Button>
        ),
        accessorFn: (row) => row.pay_group_name ?? '',
        cell: ({ row }) => (
          <span className="font-medium">{row.original.pay_group_name ?? '—'}</span>
        ),
        enableGlobalFilter: true,
      },
      {
        id: 'pay_period',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-2 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Pay Period
            {column.getIsSorted() === 'asc' ? (
              <ArrowUpIcon className="ml-2 size-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDownIcon className="ml-2 size-4" />
            ) : (
              <ArrowUpDownIcon className="ml-2 size-4 opacity-50" />
            )}
          </Button>
        ),
        accessorFn: (row) => row.year * 100 + row.month,
        cell: ({ row }) => formatPayPeriod(row.original),
        enableGlobalFilter: false,
      },
      {
        id: 'total_employees',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-2 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Employees
            {column.getIsSorted() === 'asc' ? (
              <ArrowUpIcon className="ml-2 size-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDownIcon className="ml-2 size-4" />
            ) : (
              <ArrowUpDownIcon className="ml-2 size-4 opacity-50" />
            )}
          </Button>
        ),
        accessorFn: (row) => row.total_employees,
        cell: ({ row }) => {
          const label = employeesDisplay(row.original)
          if (label === 'Not yet') {
            return <span className="text-muted-foreground">{label}</span>
          }
          return label
        },
        enableGlobalFilter: false,
      },
      {
        id: 'status',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-2 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Status
            {column.getIsSorted() === 'asc' ? (
              <ArrowUpIcon className="ml-2 size-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDownIcon className="ml-2 size-4" />
            ) : (
              <ArrowUpDownIcon className="ml-2 size-4 opacity-50" />
            )}
          </Button>
        ),
        accessorFn: (row) => row.status,
        cell: ({ row }) => {
          if (!hasPayrollEntries(row.original)) {
            return (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${INITIALIZED_PILL_CLASS}`}
              >
                Initialized
              </span>
            )
          }
          return (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusPillClass(
                row.original.status
              )}`}
            >
              {statusLabel(row.original.status)}
            </span>
          )
        },
        filterFn: (row, _columnId, value: PayrollRunStatus[]) => {
          if (!value || value.length === 0) return true
          return value.includes(row.original.status)
        },
        enableGlobalFilter: false,
      },
      {
        id: 'year',
        accessorFn: (row) => row.year,
        filterFn: (row, _columnId, value: number | undefined) => {
          if (value == null) return true
          return row.original.year === value
        },
        enableHiding: true,
        enableSorting: false,
        enableGlobalFilter: false,
      },
      {
        id: 'actions',
        header: 'Action',
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <Button variant="default" size="sm" className="cursor-pointer" asChild>
            <Link href={`/dashboard/admin/payroll/${row.original.id}`}>View run</Link>
          </Button>
        ),
        size: 96,
      },
    ],
    []
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility: { year: false },
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  const statusFilterValue = (table
    .getColumn('status')
    ?.getFilterValue() as PayrollRunStatus[] | undefined) ?? []

  const yearFilterValue = table.getColumn('year')?.getFilterValue() as
    | number
    | undefined

  const toggleStatus = (status: PayrollRunStatus, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...statusFilterValue, status]))
      : statusFilterValue.filter((s) => s !== status)
    table.getColumn('status')?.setFilterValue(next.length ? next : undefined)
  }

  const setYear = (year: number | undefined) => {
    table.getColumn('year')?.setFilterValue(year)
  }

  const totalCount = data.length
  const filteredCount = table.getFilteredRowModel().rows.length
  const rows = table.getRowModel().rows
  const isEmpty = totalCount === 0
  const pageIndex = table.getState().pagination.pageIndex
  const pageSize = table.getState().pagination.pageSize
  const pageCount = table.getPageCount()

  return (
    <div className="space-y-4 bg-card py-3 px-3 rounded-md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search pay group..."
              className="pl-8 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary!"
              value={globalFilter ?? ''}
              onChange={(event) => table.setGlobalFilter(event.target.value)}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 justify-between gap-2">
                <span>
                  Status
                  {statusFilterValue.length > 0 ? (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({statusFilterValue.length})
                    </span>
                  ) : null}
                </span>
                <ChevronDownIcon className="size-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_OPTIONS.map((opt) => (
                <DropdownMenuCheckboxItem
                  key={opt.value}
                  checked={statusFilterValue.includes(opt.value)}
                  onCheckedChange={(checked) => toggleStatus(opt.value, !!checked)}
                  onSelect={(event) => event.preventDefault()}
                >
                  {opt.label}
                </DropdownMenuCheckboxItem>
              ))}
              {statusFilterValue.length > 0 ? (
                <>
                  <DropdownMenuSeparator />
                  <button
                    type="button"
                    className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
                    onClick={() =>
                      table.getColumn('status')?.setFilterValue(undefined)
                    }
                  >
                    Clear
                  </button>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 justify-between gap-2">
                <span>{yearFilterValue ? `Year: ${yearFilterValue}` : 'Year'}</span>
                <ChevronDownIcon className="size-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36">
              <DropdownMenuLabel>Filter by year</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={yearFilterValue ? String(yearFilterValue) : ALL_YEARS}
                onValueChange={(value) =>
                  setYear(value === ALL_YEARS ? undefined : Number(value))
                }
              >
                <DropdownMenuRadioItem value={ALL_YEARS}>
                  All years
                </DropdownMenuRadioItem>
                {yearOptions.map((year) => (
                  <DropdownMenuRadioItem key={year} value={String(year)}>
                    {year}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button type="button" onClick={() => setRunPayrollOpen(true)} className="gap-2">
          <PlayIcon className="size-4" />
          Run Payroll
        </Button>
      </div>

      <RunPayrollModal
        open={runPayrollOpen}
        onOpenChange={setRunPayrollOpen}
        payGroups={payGroups}
      />

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
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {isEmpty
                    ? 'No payroll runs found.'
                    : 'No payroll runs match your filters.'}
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

      <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div>
          Showing {rows.length} of {filteredCount}
          {filteredCount !== totalCount ? ` (${totalCount} total)` : ''}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2">
                Rows per page: {pageSize}
                <ChevronDownIcon className="size-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={String(pageSize)}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                {PAGE_SIZES.map((size) => (
                  <DropdownMenuRadioItem key={size} value={String(size)}>
                    {size}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <span>
            Page {pageCount === 0 ? 0 : pageIndex + 1} of {pageCount}
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeftIcon className="size-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
