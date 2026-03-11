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
  ChevronDownIcon,
  DownloadIcon,
  FilterIcon,
  MoreHorizontalIcon,
  SearchIcon,
  XIcon,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CircularProgress } from '@/components/ui/circular-progress'
import { toast } from 'sonner'
import type { EmployeeRow, ManagerStats } from '@/lib/data/employees'
import type { DepartmentRow } from '@/lib/data/departments'
import type { JobRoleRow } from '@/lib/data/job-roles'
import type { LocationRow } from '@/lib/data/locations'
import {
  CreateEmployeeModal,
  type LineManagerOption,
} from '@/components/dashboard/CreateEmployeeModal'
import { Employee360Modal } from '@/components/dashboard/Employee360Modal'
import { exitEmployee } from '@/lib/actions/employees'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import Link from 'next/link'

const NIGERIA_STATES = [
  'Abia',
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Bayelsa',
  'Benue',
  'Borno',
  'Cross River',
  'Delta',
  'Ebonyi',
  'Edo',
  'Ekiti',
  'Enugu',
  'Gombe',
  'Imo',
  'Jigawa',
  'Kaduna',
  'Kano',
  'Katsina',
  'Kebbi',
  'Kogi',
  'Kwara',
  'Lagos',
  'Nasarawa',
  'Niger',
  'Ogun',
  'Ondo',
  'Osun',
  'Oyo',
  'Plateau',
  'Rivers',
  'Sokoto',
  'Taraba',
  'Yobe',
  'Zamfara',
  'FCT',
] as const

const MARITAL_STATUS_OPTIONS = [
  'Single',
  'Married',
  'Divorced',
  'Widowed',
  'Separated',
] as const

const RELIGION_OPTIONS = ['Christianity', 'Islam', 'Traditional', 'Other'] as const

const ETHNIC_GROUP_OPTIONS = [
  'Yoruba',
  'Igbo',
  'Hausa',
  'Fulani',
  'Ijaw',
  'Tiv',
  'Urhobo',
  'Ibibio',
  'Kanuri',
  'Other',
] as const

type EmployeesTableProps = {
  employees: EmployeeRow[]
  departments: DepartmentRow[]
  jobRoles: JobRoleRow[]
  managerStats: ManagerStats
  locations: LocationRow[]
}

type EmployeeFilters = {
  departmentId: string
  jobRoleId: string
  employmentStatus: '' | EmployeeRow['employment_status']
  contractType: '' | EmployeeRow['contract_type']
  lineManagerId: string
  workLocationId: string
  stateOfOrigin: string
  gender: string
  maritalStatus: string
  religion: string
  ethnicGroup: string
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
  return employees
    .filter((emp) => !!emp.auth_id)
    .map((emp) => {
      const name = formatEmployeeName(emp)
      const jobRoleDisplay =
        emp.job_role_title && emp.job_role_code?.trim()
          ? `${emp.job_role_title} (${emp.job_role_code.trim()})`
          : emp.job_role_title ?? '—'
      return {
        id: emp.auth_id!,
        employeeId: emp.id,
        name,
        jobRoleDisplay,
        avatarUrl: emp.avatar_url ?? null,
      }
    })
}

type ExportRow = Record<string, string>

export function EmployeesTable({
  employees,
  departments,
  jobRoles,
  managerStats,
  locations,
}: EmployeesTableProps) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [filters, setFilters] = useState<EmployeeFilters>({
    departmentId: '',
    jobRoleId: '',
    employmentStatus: '',
    contractType: '',
    lineManagerId: '',
    workLocationId: '',
    stateOfOrigin: '',
    gender: '',
    maritalStatus: '',
    religion: '',
    ethnicGroup: '',
  })
  const [exitTarget, setExitTarget] = useState<{ id: string; name: string } | null>(null)
  const [exiting, setExiting] = useState(false)
  const lineManagerOptions = useMemo(() => toLineManagerOptions(employees), [employees])
  const [lineManagerFilterOpen, setLineManagerFilterOpen] = useState(false)
  const [lineManagerFilterSearch, setLineManagerFilterSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const selectedLineManager = useMemo(
    () => lineManagerOptions.find((m) => m.id === filters.lineManagerId) ?? null,
    [lineManagerOptions, filters.lineManagerId]
  )

  const filteredLineManagerOptions = useMemo(() => {
    const q = lineManagerFilterSearch.trim().toLowerCase()
    if (!q) return lineManagerOptions
    return lineManagerOptions.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.jobRoleDisplay.toLowerCase().includes(q)
    )
  }, [lineManagerFilterSearch, lineManagerOptions])

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (filters.departmentId && emp.department_id !== filters.departmentId) return false
      if (filters.jobRoleId && emp.job_role_id !== filters.jobRoleId) return false
      if (filters.employmentStatus && emp.employment_status !== filters.employmentStatus) return false
      if (filters.contractType && emp.contract_type !== filters.contractType) return false
      if (filters.lineManagerId && emp.manager_id !== filters.lineManagerId) return false
      if (filters.workLocationId && emp.report_location !== filters.workLocationId) return false
      if (filters.stateOfOrigin && emp.biodata_state !== filters.stateOfOrigin) return false
       if (filters.gender && emp.biodata_gender !== filters.gender) return false
       if (filters.maritalStatus && emp.biodata_marital_status !== filters.maritalStatus) return false
       if (filters.religion && emp.biodata_religion !== filters.religion) return false
      if (filters.ethnicGroup && emp.biodata_ethnic_group !== filters.ethnicGroup) return false

      return true
    })
  }, [employees, filters])

  const lineManagerById = useMemo(() => {
    const map = new Map<string, LineManagerOption>()
    for (const m of lineManagerOptions) {
      map.set(m.id, m)
    }
    return map
  }, [lineManagerOptions])

  const workLocationById = useMemo(() => {
    const map = new Map<string, string>()
    for (const loc of locations) {
      const parts: string[] = []
      if (loc.state) parts.push(loc.state)
      if (loc.address) {
        const addr =
          loc.address.length > 40 ? `${loc.address.slice(0, 40)}...` : loc.address
        parts.push(addr)
      }
      const display =
        parts.length > 0 ? parts.join(' - ') : `Location ${loc.id.slice(0, 8)}`
      map.set(loc.id, display)
    }
    return map
  }, [locations])

  const toExportRow = (emp: EmployeeRow): ExportRow => {
    const deptName = emp.department_name ?? ''
    const deptCode = emp.department_code?.trim() ?? ''
    const department =
      deptName || deptCode
        ? deptCode
          ? `${deptName} (${deptCode})`
          : deptName
        : ''

    const jobTitle = emp.job_role_title ?? ''
    const jobCode = emp.job_role_code?.trim() ?? ''
    const jobRole =
      jobTitle || jobCode
        ? jobCode
          ? `${jobTitle} (${jobCode})`
          : jobTitle
        : ''

    const manager =
      emp.manager_id && lineManagerById.get(emp.manager_id)
        ? lineManagerById.get(emp.manager_id)!.name
        : ''

    const workLocation =
      emp.report_location && workLocationById.get(emp.report_location)
        ? workLocationById.get(emp.report_location)!
        : ''

    const name = formatEmployeeName(emp)

    const startDate = emp.start_date
      ? new Date(emp.start_date).toISOString().slice(0, 10)
      : ''
    const endDate = emp.end_date
      ? new Date(emp.end_date).toISOString().slice(0, 10)
      : ''

    return {
      'Staff ID': emp.staff_id,
      Name: name,
      Email: emp.email,
      Phone: emp.phone ?? '',
      Department: department,
      'Job role': jobRole,
      'Employment status': emp.employment_status,
      'Contract type': emp.contract_type,
      'Line manager': manager,
      'Work location': workLocation,
      'State of origin': emp.biodata_state ?? '',
      Gender: emp.biodata_gender ?? '',
      'Marital status': emp.biodata_marital_status ?? '',
      Religion: emp.biodata_religion ?? '',
      'Ethnic group': emp.biodata_ethnic_group ?? '',
      'Start date': startDate,
      'End date': endDate,
      Active: emp.active ? 'Yes' : 'No',
    }
  }

  const openProfile = (id: string) => {
    setSelectedEmployeeId(id)
    setProfileOpen(true)
  }

  const handleExitConfirm = async () => {
    if (!exitTarget) return
    setExiting(true)
    const result = await exitEmployee(exitTarget.id)
    setExiting(false)
    setExitTarget(null)
    if (result.success) {
      toast.success(`${exitTarget.name} has been exited successfully.`)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

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
            <button
              type="button"
              className="flex items-center gap-2 cursor-pointer text-left"
              onClick={() => openProfile(employee.id)}
            >
              <Avatar size="sm" className="size-8 shrink-0">
                {employee.avatar_url ? (
                  <AvatarImage src={employee.avatar_url} alt={name} />
                ) : null}
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="font-medium">{name}</span>
            </button>
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
              <DropdownMenuItem onClick={() => openProfile(_row.original.id)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() =>
                  setExitTarget({
                    id: _row.original.id,
                    name: formatEmployeeName(_row.original),
                  })
                }
              >
                Exit Employee
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
    data: filteredEmployees,
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

  const handleExportCsv = () => {
    const tableRows = table.getFilteredRowModel().rows
    if (tableRows.length === 0) {
      toast.info('No employees to export.')
      return
    }

    const data = tableRows.map((row) => toExportRow(row.original))
    if (data.length === 0) {
      toast.info('No employees to export.')
      return
    }

    const headers = Object.keys(data[0])

    const escapeCell = (value: string): string => {
      let v = value ?? ''
      if (v.includes('"')) {
        v = v.replace(/"/g, '""')
      }
      if (/[",\n\r]/.test(v)) {
        v = `"${v}"`
      }
      return v
    }

    const lines: string[] = []
    lines.push(headers.join(','))
    for (const row of data) {
      const line = headers.map((h) => escapeCell(row[h] ?? '')).join(',')
      lines.push(line)
    }

    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleExportExcel = async () => {
    const tableRows = table.getFilteredRowModel().rows
    if (tableRows.length === 0) {
      toast.info('No employees to export.')
      return
    }

    setExporting(true)
    try {
      const data = tableRows.map((row) => toExportRow(row.original))
      if (data.length === 0) {
        toast.info('No employees to export.')
        return
      }

      const XLSX = await import('xlsx')
      const worksheet = XLSX.utils.json_to_sheet(data)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees')

      const wbout = XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
      })

      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `employees-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('[EmployeesTable] Failed to export Excel:', error)
      toast.error('Failed to export Excel file.')
    } finally {
      setExporting(false)
    }
  }

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
          <button
            type="button"
            className="flex items-center gap-1 bg-primary rounded-md px-4 py-[10px] text-xs font-normal"
            onClick={() => {
              if (filtersOpen) {
                setFilters({
                  departmentId: '',
                  jobRoleId: '',
                  employmentStatus: '',
                  contractType: '',
                  lineManagerId: '',
                  workLocationId: '',
                  stateOfOrigin: '',
                  gender: '',
                  maritalStatus: '',
                  religion: '',
                  ethnicGroup: '',
                })
              }
              setFiltersOpen(!filtersOpen)
            }}
          >
            {filtersOpen ? <XIcon className="size-3 text-white" /> : <FilterIcon className="size-3 text-white" />}
            <span className="text-xs font-medium text-white">{filtersOpen ? "close" : "filter"}</span>
          </button>
        </div>
        <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full lg:w-auto"
                disabled={table.getFilteredRowModel().rows.length === 0 || exporting}
              >
                <DownloadIcon className="mr-2 size-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handleExportCsv()}
                disabled={table.getFilteredRowModel().rows.length === 0 || exporting}
              >
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExportExcel()}
                disabled={table.getFilteredRowModel().rows.length === 0 || exporting}
              >
                Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-primary text-white hover:bg-primary/90 w-full lg:w-auto lg:inline-block text-center"
          >
            Add New
          </Button>
          <Button
            asChild
            className="bg-black text-white hover:bg-black/90 block lg:inline-block text-center"
          >
            <Link href="/dashboard/admin/employees/bulk-upload">Add Bulk</Link>
          </Button>
        </div>
        
      </div>

      {/* Filters row */}
      {filtersOpen ? <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 rounded-md border bg-muted/40 p-3 text-sm">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Department</span>
          <select
            className="h-8 rounded-md border bg-background px-2 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
            value={filters.departmentId}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, departmentId: e.target.value }))
            }
          >
            <option value="">All</option>
            {departments.map((dept) => {
              const display =
                dept.code && dept.code.trim().length > 0
                  ? `${dept.name} (${dept.code.trim()})`
                  : dept.name
              return (
                <option key={dept.id} value={dept.id}>
                  {display}
                </option>
              )
            })}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Job role</span>
          <select
            className="h-8 rounded-md border bg-background px-2 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
            value={filters.jobRoleId}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, jobRoleId: e.target.value }))
            }
          >
            <option value="">All</option>
            {jobRoles.map((jr) => {
              const display =
                jr.code && jr.code.trim().length > 0
                  ? `${jr.name} (${jr.code.trim()})`
                  : jr.name
              return (
                <option key={jr.id} value={jr.id}>
                  {display}
                </option>
              )
            })}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Employment status</span>
          <select
            className="h-8 rounded-md border bg-background px-2 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
            value={filters.employmentStatus}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                employmentStatus: e.target.value as EmployeeFilters['employmentStatus'],
              }))
            }
          >
            <option value="">All</option>
            <option value="probation">Probation</option>
            <option value="confirmed">Confirmed</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Contract type</span>
          <select
            className="h-8 rounded-md border bg-background px-2 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
            value={filters.contractType}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                contractType: e.target.value as EmployeeFilters['contractType'],
              }))
            }
          >
            <option value="">All</option>
            <option value="permanent">Permanent</option>
            <option value="part_time">Part time</option>
            <option value="fixed_term">Fixed term</option>
            <option value="temporary">Temporary</option>
            <option value="intern">Intern</option>
            <option value="contractor">Contractor</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Line manager</span>
          <Popover 
            open={lineManagerFilterOpen}
            onOpenChange={(open) => {
              setLineManagerFilterOpen(open)
              if (!open) setLineManagerFilterSearch('')
            }}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-8 w-full justify-between px-2 text-left text-xs font-normal"
              >
                <span className={selectedLineManager ? '' : 'text-muted-foreground'}>
                  {selectedLineManager ? selectedLineManager.name : 'All line managers'}
                </span>
                <ChevronDownIcon className="ml-2 size-3 shrink-0 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-(--radix-popover-trigger-width) p-0"
              align="start"
            >
              <div className="border-b p-2">
                <div className="relative">
                  <SearchIcon className="absolute left-2.5 top-2.5 size-3 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    className="h-7 pl-7 pr-2 text-xs focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
                    value={lineManagerFilterSearch}
                    onChange={(e) => setLineManagerFilterSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-auto p-1">
                <button
                  type="button"
                  className={`mb-1 flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-accent ${
                    !filters.lineManagerId ? 'bg-accent' : ''
                  }`}
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, lineManagerId: '' }))
                    setLineManagerFilterOpen(false)
                  }}
                >
                  <span className="text-muted-foreground">All line managers</span>
                </button>
                {filteredLineManagerOptions.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted-foreground">
                    No line manager found.
                  </p>
                ) : (
                  filteredLineManagerOptions.map((manager) => {
                    const initials = manager.name
                      .split(/\s+/)
                      .map((s) => s[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)
                    const isSelected = filters.lineManagerId === manager.id
                    return (
                      <button
                        key={manager.id}
                        type="button"
                        className={`mb-1 flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent ${
                          isSelected ? 'bg-accent' : ''
                        }`}
                        onClick={() => {
                          setFilters((prev) => ({ ...prev, lineManagerId: manager.id }))
                          setLineManagerFilterOpen(false)
                          setLineManagerFilterSearch('')
                        }}
                      >
                        <Avatar className="size-6 shrink-0">
                          {manager.avatarUrl ? (
                            <AvatarImage src={manager.avatarUrl} alt={manager.name} />
                          ) : null}
                          <AvatarFallback className="text-[10px]">
                            {initials || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{manager.name}</p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {manager.jobRoleDisplay}
                          </p>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Work location</span>
          <select
            className="h-8 rounded-md border bg-background px-2 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
            value={filters.workLocationId}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, workLocationId: e.target.value }))
            }
          >
            <option value="">All</option>
            {locations.map((loc) => {
              const parts: string[] = []
              if (loc.state) parts.push(loc.state)
              if (loc.address) {
                const addr =
                  loc.address.length > 40 ? `${loc.address.slice(0, 40)}...` : loc.address
                parts.push(addr)
              }
              const display =
                parts.length > 0 ? parts.join(' - ') : `Location ${loc.id.slice(0, 8)}`
              return (
                <option key={loc.id} value={loc.id}>
                  {display}
                </option>
              )
            })}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">State of origin</span>
          <select
            className="h-8 rounded-md border bg-background px-2 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
            value={filters.stateOfOrigin}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, stateOfOrigin: e.target.value }))
            }
          >
            <option value="">All</option>
            {NIGERIA_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Gender</span>
          <select
            className="h-8 rounded-md border bg-background px-2 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
            value={filters.gender}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, gender: e.target.value }))
            }
          >
            <option value="">All</option>
            {Array.from(
              new Set(
                employees
                  .map((e) => e.biodata_gender)
                  .filter((v): v is string => !!v && v.trim().length > 0)
              )
            ).map((gender) => (
              <option key={gender} value={gender}>
                {gender === 'male' ? 'Male' : gender === 'female' ? 'Female' : gender === 'other' ? 'Other' : gender === 'prefer_not_to_say' ? 'Prefer not to say' : gender}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Marital status</span>
          <select
            className="h-8 rounded-md border bg-background px-2 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
            value={filters.maritalStatus}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, maritalStatus: e.target.value }))
            }
          >
            <option value="">All</option>
            {MARITAL_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Religion</span>
          <select
            className="h-8 rounded-md border bg-background px-2 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
            value={filters.religion}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, religion: e.target.value }))
            }
          >
            <option value="">All</option>
            {RELIGION_OPTIONS.map((religion) => (
              <option key={religion} value={religion}>
                {religion}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Ethnic group</span>
          <select
            className="h-8 rounded-md border bg-background px-2 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
            value={filters.ethnicGroup}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, ethnicGroup: e.target.value }))
            }
          >
            <option value="">All</option>
            {ETHNIC_GROUP_OPTIONS.map((ethnic) => (
              <option key={ethnic} value={ethnic}>
                {ethnic}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() =>
              setFilters({
                departmentId: '',
                jobRoleId: '',
                employmentStatus: '',
                contractType: '',
                lineManagerId: '',
                workLocationId: '',
                stateOfOrigin: '',
                gender: '',
                maritalStatus: '',
                religion: '',
                ethnicGroup: '',
              })
            }
          >
            Clear filters
          </Button>
        </div>
      </div> : null}

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

      <Employee360Modal
        employeeId={selectedEmployeeId}
        open={profileOpen}
        onOpenChange={(o) => {
          setProfileOpen(o)
          if (!o) setSelectedEmployeeId(null)
        }}
        departments={departments}
        jobRoles={jobRoles}
        lineManagerOptions={lineManagerOptions}
        managerStats={managerStats}
        locations={locations}
      />

      <AlertDialog open={!!exitTarget} onOpenChange={(o) => { if (!o && !exiting) setExitTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit employee?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently deactivate <strong>{exitTarget?.name}</strong>, remove their
              profile, and delete their login access. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={exiting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleExitConfirm() }}
              disabled={exiting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {exiting ? 'Exiting…' : 'Exit Employee'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}