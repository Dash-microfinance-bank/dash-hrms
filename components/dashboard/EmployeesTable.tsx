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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CircularProgress } from '@/components/ui/circular-progress'
import type { EmployeeRow, ManagerStats } from '@/lib/data/employees'
import type { DepartmentRow } from '@/lib/data/departments'
import type { JobRoleRow } from '@/lib/data/job-roles'
import type { LocationRow } from '@/lib/data/locations'
import {
  CreateEmployeeModal,
  type LineManagerOption,
} from '@/components/dashboard/CreateEmployeeModal'

type EmployeesTableProps = {
  employees: EmployeeRow[]
  departments: DepartmentRow[]
  jobRoles: JobRoleRow[]
  managerStats: ManagerStats
  locations: LocationRow[]
}

function formatEmployeeName(employee: EmployeeRow): string {
  const parts: string[] = []
  if (employee.biodata_title) {
    parts.push(employee.biodata_title)
  }
  if (employee.biodata_firstname) {
    parts.push(employee.biodata_firstname)
  }
  if (employee.biodata_lastname) {
    parts.push(employee.biodata_lastname)
  }
  if (parts.length === 0) {
    return employee.email
  }
  return parts.join(' ')
}

function toLineManagerOptions(employees: EmployeeRow[]): LineManagerOption[] {
  return employees.map((emp) => {
    const name = formatEmployeeName(emp)
    const jobRoleDisplay =
      emp.job_role_title && emp.job_role_code?.trim()
        ? `${emp.job_role_title} (${emp.job_role_code.trim()})`
        : emp.job_role_title ?? '—'
    return {
      id: emp.id,
      name,
      jobRoleDisplay,
      avatarUrl: emp.avatar_url ?? null,
    }
  })
}

export function EmployeesTable({
  employees,
  departments,
  jobRoles,
  managerStats,
  locations,
}: EmployeesTableProps) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const lineManagerOptions = useMemo(() => toLineManagerOptions(employees), [employees])

  const columns = useMemo<ColumnDef<EmployeeRow>[]>(
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
        accessorFn: (row) => formatEmployeeName(row),
        cell: ({ row }) => {
          const employee = row.original
          const name = formatEmployeeName(employee)
          
          // Generate initials for avatar fallback
          const initials = (() => {
            const parts: string[] = []
            if (employee.biodata_firstname) {
              parts.push(employee.biodata_firstname[0])
            }
            if (employee.biodata_lastname) {
              parts.push(employee.biodata_lastname[0])
            }
            if (parts.length === 0 && employee.email) {
              parts.push(employee.email[0])
            }
            return parts.join('').toUpperCase().slice(0, 2) || '?'
          })()

          return (
            <div className="flex items-center gap-2">
              <Avatar size="sm" className="size-8 shrink-0">
                {employee.avatar_url ? (
                  <AvatarImage src={employee.avatar_url} alt={name} />
                ) : null}
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="font-medium">{name}</span>
            </div>
          )
        },
      },
      {
        id: 'email',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-2 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Email
            {column.getIsSorted() === 'asc' ? (
              <ArrowUpIcon className="ml-2 size-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDownIcon className="ml-2 size-4" />
            ) : (
              <ArrowUpDownIcon className="ml-2 size-4 opacity-50" />
            )}
          </Button>
        ),
        accessorFn: (row) => row.email,
        cell: ({ row }) => <span>{row.original.email}</span>,
      },
      {
        id: 'department',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-2 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Department
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
          const name = row.department_name ?? ''
          const code = row.department_code?.trim() ?? ''
          if (!name && !code) return ''
          return code ? `${name} (${code})` : name
        },
        cell: ({ row }) => {
          const name = row.original.department_name
          const code = row.original.department_code?.trim()
          if (!name && !code) {
            return <span className="text-muted-foreground">—</span>
          }
          const display = code && code.length > 0 ? `${name} (${code})` : name
          return <span>{display}</span>
        },
      },
      {
        id: 'job_role',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-2 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Job Role
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
          const title = row.job_role_title ?? ''
          const code = row.job_role_code?.trim() ?? ''
          if (!title && !code) return ''
          return code ? `${title} (${code})` : title
        },
        cell: ({ row }) => {
          const title = row.original.job_role_title
          const code = row.original.job_role_code?.trim()
          if (!title && !code) {
            return <span className="text-muted-foreground">—</span>
          }
          const display = code && code.length > 0 ? `${title} (${code})` : title
          return <span>{display}</span>
        },
      },
      {
        id: 'profile_completion',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-2 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Profile completion
            {column.getIsSorted() === 'asc' ? (
              <ArrowUpIcon className="ml-2 size-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDownIcon className="ml-2 size-4" />
            ) : (
              <ArrowUpDownIcon className="ml-2 size-4 opacity-50" />
            )}
          </Button>
        ),
        accessorFn: (row) => row.profile_completion_pct,
        cell: ({ row }) => {
          const pct = row.original.profile_completion_pct
          return (
            <div className="flex w-full items-center justify-center">
              <CircularProgress value={pct} size={32} showLabel />
            </div>
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
        cell: ({ row: _row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontalIcon className="size-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>Edit</DropdownMenuItem>
              <DropdownMenuItem disabled className="text-destructive focus:text-destructive">
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
    data: employees,
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
  const isEmpty = employees.length === 0

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
              placeholder="Search employees..."
              className="pl-8 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary!"
              value={globalFilter ?? ''}
              onChange={(event) => table.setGlobalFilter(event.target.value)}
            />
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>New employee</Button>
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
                <TableCell colSpan={7} className="h-32 text-center align-middle">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {isEmpty
                        ? 'No employees found for this organization.'
                        : 'No employees match your search.'}
                    </p>
                    {isEmpty && (
                      <Button size="sm" onClick={() => setCreateOpen(true)}>
                        Create your first employee
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
            Showing {rows.length} of {employees.length} employees
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

      <CreateEmployeeModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleSuccess}
        departments={departments}
        jobRoles={jobRoles}
        lineManagerOptions={lineManagerOptions}
        managerStats={managerStats}
        locations={locations}
      />
    </div>
  )
}