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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { ProfileUpdateRequestListRow } from '@/lib/data/profile-update-requests'
import ProfileUpdateRequestModal from './ProfileUpdateRequestModal'

type ProfileUpdateRequestsTableProps = {
  requests: ProfileUpdateRequestListRow[]
}

function formatEmployeeName(row: ProfileUpdateRequestListRow): string {
  const parts: string[] = []
  if (row.employee_firstname) parts.push(row.employee_firstname)
  if (row.employee_lastname) parts.push(row.employee_lastname)
  if (parts.length === 0) {
    return row.employee_email || 'Unknown employee'
  }
  return parts.join(' ')
}

function formatStatus(status: ProfileUpdateRequestListRow['status']): string {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'approved':
      return 'Approved'
    case 'rejected':
      return 'Rejected'
    case 'partially_approved':
      return 'Partially approved'
    default:
      return status
  }
}

function statusClassName(status: ProfileUpdateRequestListRow['status']): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-50 text-amber-800 border-amber-200'
    case 'approved':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200'
    case 'rejected':
      return 'bg-rose-50 text-rose-800 border-rose-200'
    case 'partially_approved':
      return 'bg-sky-50 text-sky-800 border-sky-200'
    default:
      return 'bg-muted text-foreground border-transparent'
  }
}

export function ProfileUpdateRequestsTable({
  requests,
}: ProfileUpdateRequestsTableProps) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'submitted_at', desc: true },
  ])
  const [globalFilter, setGlobalFilter] = useState('')
  const [reviewRequestId, setReviewRequestId] = useState<string | null>(null)

  const columns = useMemo<ColumnDef<ProfileUpdateRequestListRow>[]>(
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
        id: 'employee',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-2 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Employee
            {column.getIsSorted() === 'asc' ? (
              <ArrowUpIcon className="ml-2 size-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDownIcon className="ml-2 size-4" />
            ) : (
              <ArrowUpDownIcon className="ml-2 size-4 opacity-50" />
            )}
          </Button>
        ),
        accessorFn: (row) => formatEmployeeName(row),
        cell: ({ row }) => {
          const request = row.original
          const name = formatEmployeeName(request)

          const initials = (() => {
            const parts: string[] = []
            if (request.employee_firstname) {
              parts.push(request.employee_firstname[0])
            }
            if (request.employee_lastname) {
              parts.push(request.employee_lastname[0])
            }
            if (parts.length === 0 && request.employee_email) {
              parts.push(request.employee_email[0])
            }
            return parts.join('').toUpperCase().slice(0, 2) || '?'
          })()

          return (
            <button
              type="button"
              className="flex items-center gap-2 cursor-pointer text-left"
              onClick={() => setReviewRequestId(request.id)}
            >
              <Avatar size="sm" className="size-8 shrink-0">
                {request.avatar_url ? (
                  <AvatarImage src={request.avatar_url} alt={name} />
                ) : null}
                <AvatarFallback className="text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium">{name}</span>
                {request.employee_email ? (
                  <span className="text-xs text-muted-foreground">
                    {request.employee_email}
                  </span>
                ) : null}
              </div>
            </button>
          )
        },
      },
      {
        id: 'submitted_at',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-2 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Date submitted
            {column.getIsSorted() === 'asc' ? (
              <ArrowUpIcon className="ml-2 size-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDownIcon className="ml-2 size-4" />
            ) : (
              <ArrowUpDownIcon className="ml-2 size-4 opacity-50" />
            )}
          </Button>
        ),
        accessorFn: (row) => row.submitted_at ?? row.created_at,
        sortingFn: (rowA, rowB) => {
          const a = new Date(
            rowA.original.submitted_at ?? rowA.original.created_at
          ).getTime()
          const b = new Date(
            rowB.original.submitted_at ?? rowB.original.created_at
          ).getTime()
          return a - b
        },
        cell: ({ row }) => {
          const value = row.original.submitted_at ?? row.original.created_at
          const date = new Date(value)
          return (
            <span className="text-muted-foreground">
              {date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          )
        },
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
          const status = row.original.status
          return (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusClassName(
                status
              )}`}
            >
              {formatStatus(status)}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: 'Action',
        enableSorting: false,
        cell: ({ row }) => {
          const request = row.original
          return (
            <Button
              size="sm"
              className="text-xs"
              onClick={() => setReviewRequestId(request.id)}
            >
              Review
            </Button>
          )
        },
      },
    ],
    []
  )

  const table = useReactTable({
    data: requests,
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
  const isEmpty = requests.length === 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by employee or email..."
            className="pl-8 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary!"
            value={globalFilter ?? ''}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
          />
        </div>
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
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-32 text-center align-middle"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {isEmpty
                        ? 'No profile update requests found for this organization.'
                        : 'No profile update requests match your search.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
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
            Showing {rows.length} of {requests.length} requests
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

      <ProfileUpdateRequestModal
        requestId={reviewRequestId}
        open={!!reviewRequestId}
        onOpenChange={(o) => !o && setReviewRequestId(null)}
        onSuccess={() => {
          setReviewRequestId(null)
          router.refresh()
        }}
      />
    </div>
  )
}

