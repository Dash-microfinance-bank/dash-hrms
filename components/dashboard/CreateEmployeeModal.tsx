'use client'

import React, { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createEmployee } from '@/lib/actions/employees'
import type { DepartmentRow } from '@/lib/data/departments'
import type { JobRoleRow } from '@/lib/data/job-roles'
import type { ManagerStats } from '@/lib/data/employees'
import type { LocationRow } from '@/lib/data/locations'
import { toast } from 'sonner'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronDownIcon, SearchIcon, UserIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type LineManagerOption = {
  id: string
  name: string
  jobRoleDisplay: string
  avatarUrl?: string | null
}

const CONTRACT_TYPES = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'fixed_term', label: 'Fixed Term' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'intern', label: 'Intern' },
  { value: 'contractor', label: 'Contractor' },
] as const

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const

const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'probation', label: 'Probation' },
  { value: 'confirmed', label: 'Confirmed' },
] as const

const createEmployeeSchema = z
  .object({
    staff_id: z.string().min(1, 'Staff ID is required').max(50, 'Staff ID is too long').trim(),
    firstname: z.string().min(1, 'First name is required').max(100, 'First name is too long').trim(),
    lastname: z.string().min(1, 'Last name is required').max(100, 'Last name is too long').trim(),
    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say'], {
      error: 'Gender is required',
    }),
    email: z.string().min(1, 'Email is required').email('Enter a valid email').trim(),
    phone: z.string().min(1, 'Phone number is required').max(20, 'Phone number is too long').trim(),
    contract_type: z.enum(
      ['permanent', 'part_time', 'fixed_term', 'temporary', 'intern', 'contractor'],
      { error: 'Contract type is required' }
    ),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().optional(),
    employment_status: z.enum(['probation', 'confirmed'], {
      error: 'Employment status is required',
    }),
    department_id: z.string().min(1, 'Department is required'),
    job_role_id: z.string().min(1, 'Job role is required'),
    manager_id: z.string().optional(),
    report_location: z.string().optional().or(z.literal('')),
  })
  .refine(
    (data) => {
      // Permanent and part_time contracts should not have end_date
      if (data.contract_type === 'permanent' || data.contract_type === 'part_time') {
        return !data.end_date || data.end_date.trim() === ''
      }
      // All other contract types require end_date
      return !!data.end_date && data.end_date.trim() !== ''
    },
    {
      message: 'End date is required for fixed-term, temporary, intern, and contractor contracts. End date should not be set for permanent or part-time contracts',
      path: ['end_date'],
    }
  )
  .refine(
    (data) => {
      // If end_date is provided, it must be after start_date
      if (data.end_date && data.end_date.trim() !== '' && data.start_date) {
        const start = new Date(data.start_date)
        const end = new Date(data.end_date)
        return start < end
      }
      return true
    },
    {
      message: 'End date must be after start date',
      path: ['end_date'],
    }
  )

type CreateEmployeeFormValues = z.infer<typeof createEmployeeSchema>

type CreateEmployeeModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  departments: DepartmentRow[]
  jobRoles: JobRoleRow[]
  lineManagerOptions: LineManagerOption[]
  managerStats: ManagerStats
  locations: LocationRow[]
}

function CreateEmployeeFormBody({
  onOpenChange,
  onSuccess,
  departments,
  jobRoles,
  lineManagerOptions,
  managerStats,
  locations,
}: Pick<CreateEmployeeModalProps, 'onOpenChange' | 'onSuccess' | 'departments' | 'jobRoles' | 'lineManagerOptions' | 'managerStats' | 'locations'>) {
  const [managerSearch, setManagerSearch] = useState('')
  const [managerOpen, setManagerOpen] = useState(false)

  const handleManagerOpenChange = (open: boolean) => {
    setManagerOpen(open)
    if (!open) setManagerSearch('')
  }

  const form = useForm<CreateEmployeeFormValues>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      staff_id: '',
      firstname: '',
      lastname: '',
      gender: 'male',
      email: '',
      phone: '',
      contract_type: 'permanent',
      start_date: '',
      end_date: '',
      employment_status: 'probation',
      department_id: '',
      job_role_id: '',
      manager_id: '',
      report_location: '',
    },
  })

  const { register, handleSubmit, setValue, control, formState: { errors, isSubmitting } } = form
  const contractType = useWatch({ control, name: 'contract_type', defaultValue: 'permanent' })
  const departmentId = useWatch({ control, name: 'department_id', defaultValue: '' })
  const managerId = useWatch({ control, name: 'manager_id', defaultValue: '' })

  const handleDepartmentChange = (value: string) => {
    setValue('department_id', value)
    setValue('job_role_id', '')
  }

  const availableJobRoles = jobRoles.filter((jr) => jr.department_id === departmentId)
  const activeDepartments = departments.filter((d) => d.is_active)

  // Filter out excluded employees (self and subordinates)
  const availableManagers = useMemo(() => {
    return lineManagerOptions.filter((m) => !managerStats.excludedIds.includes(m.id))
  }, [lineManagerOptions, managerStats.excludedIds])

  // Get top 5 managers as suggestions
  const topManagers = useMemo(() => {
    const topManagerIds = new Set(managerStats.topManagers.map((m) => m.id))
    return availableManagers
      .filter((m) => topManagerIds.has(m.id))
      .slice(0, 5)
      .sort((a, b) => {
        const aIndex = managerStats.topManagers.findIndex((tm) => tm.id === a.id)
        const bIndex = managerStats.topManagers.findIndex((tm) => tm.id === b.id)
        return aIndex - bIndex
      })
  }, [availableManagers, managerStats.topManagers])

  const selectedManager = useMemo(
    () => availableManagers.find((m) => m.id === managerId),
    [availableManagers, managerId]
  )

  // Filter managers based on search, excluding self and subordinates
  const filteredManagers = useMemo(() => {
    if (!managerSearch.trim()) {
      // When no search, show top 5 managers as suggestions
      return topManagers
    }
    const q = managerSearch.trim().toLowerCase()
    return availableManagers.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.jobRoleDisplay.toLowerCase().includes(q)
    )
  }, [managerSearch, availableManagers, topManagers])

  const onSubmit = async (values: CreateEmployeeFormValues) => {
    const result = await createEmployee({
      staff_id: values.staff_id,
      firstname: values.firstname,
      lastname: values.lastname,
      gender: values.gender,
      email: values.email,
      phone: values.phone,
      contract_type: values.contract_type,
      start_date: values.start_date,
      end_date: values.end_date || null,
      employment_status: values.employment_status,
      department_id: values.department_id,
      job_role_id: values.job_role_id,
      manager_id: values.manager_id || null,
      report_location: values.report_location || null,
    })

    if (result.success) {
      toast.success('Employee created')
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <>
      <DialogHeader className=''>
        <DialogTitle>Create employee</DialogTitle>
        <DialogDescription>
          Add a new employee to your organization. The employee will be linked to a department and
          job role.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="employee-staff-id" className="ml-2 text-sm font-medium">
              Staff ID
            </label>
            <Input
              id="employee-staff-id"
              placeholder="e.g. EMP001"
              {...register('staff_id')}
              className={errors.staff_id ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'}
            />
            {errors.staff_id && (
              <p className="ml-2 text-xs text-destructive">{errors.staff_id.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="employee-email" className="ml-2 text-sm font-medium">
              Email
            </label>
            <Input
              id="employee-email"
              type="email"
              placeholder="employee@example.com"
              {...register('email')}
              className={errors.email ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'}
            />
            {errors.email && (
              <p className="ml-2 text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="employee-firstname" className="ml-2 text-sm font-medium">
              First Name
            </label>
            <Input
              id="employee-firstname"
              placeholder="e.g. Michael"
              {...register('firstname')}
              className={errors.firstname ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'}
            />
            {errors.firstname && (
              <p className="ml-2 text-xs text-destructive">{errors.firstname.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="employee-lastname" className="ml-2 text-sm font-medium">
              Last Name
            </label>
            <Input
              id="employee-lastname"
              placeholder="e.g. Adeniji"
              {...register('lastname')}
              className={errors.lastname ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'}
            />
            {errors.lastname && (
              <p className="ml-2 text-xs text-destructive">{errors.lastname.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="employee-gender" className="ml-2 text-sm font-medium">
              Gender
            </label>
            <select
              id="employee-gender"
              {...register('gender')}
              className={cn(
                'h-9 w-full rounded-md border bg-background px-3 py-1 text-sm',
                errors.gender ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
              )}
            >
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.gender && (
              <p className="ml-2 text-xs text-destructive">{errors.gender.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="employee-phone" className="ml-2 text-sm font-medium">
              Phone Number
            </label>
            <Input
              id="employee-phone"
              placeholder="e.g. +234 800 000 0000"
              {...register('phone')}
              className={errors.phone ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'}
            />
            {errors.phone && (
              <p className="ml-2 text-xs text-destructive">{errors.phone.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="employee-contract-type" className="ml-2 text-sm font-medium">
              Contract Type
            </label>
            <select
              id="employee-contract-type"
              {...register('contract_type')}
              className={cn(
                'h-9 w-full rounded-md border bg-background px-3 py-1 text-sm',
                errors.contract_type ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
              )}
            >
              {CONTRACT_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.contract_type && (
              <p className="ml-2 text-xs text-destructive">{errors.contract_type.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="employee-employment-status" className="ml-2 text-sm font-medium">
              Employment Status
            </label>
            <select
              id="employee-employment-status"
              {...register('employment_status')}
              className={cn(
                'h-9 w-full rounded-md border bg-background px-3 py-1 text-sm',
                errors.employment_status ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
              )}
            >
              {EMPLOYMENT_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.employment_status && (
              <p className="ml-2 text-xs text-destructive">{errors.employment_status.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="employee-start-date" className="ml-2 text-sm font-medium">
              Start Date
            </label>
            <Input
              id="employee-start-date"
              type="date"
              {...register('start_date')}
              className={errors.start_date ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'}
            />
            {errors.start_date && (
              <p className="ml-2 text-xs text-destructive">{errors.start_date.message}</p>
            )}
          </div>
          {contractType !== 'permanent' && contractType !== 'part_time' && (
            <div className="space-y-2">
              <label htmlFor="employee-end-date" className="ml-2 text-sm font-medium">
                End Date
              </label>
              <Input
                id="employee-end-date"
                type="date"
                {...register('end_date')}
                className={errors.end_date ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'}
              />
              {errors.end_date && (
                <p className="ml-2 text-xs text-destructive">{errors.end_date.message}</p>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="employee-department" className="ml-2 text-sm font-medium">
              Department
            </label>
            <select
              id="employee-department"
              value={departmentId}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              className={cn(
                'h-9 w-full rounded-md border bg-background px-3 py-1 text-sm',
                errors.department_id ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
              )}
            >
              <option value="">Select department</option>
              {activeDepartments.map((dept) => {
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
            {errors.department_id && (
              <p className="ml-2 text-xs text-destructive">{errors.department_id.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="employee-job-role" className="ml-2 text-sm font-medium">
              Job Role
            </label>
            <select
              id="employee-job-role"
              {...register('job_role_id')}
              disabled={!departmentId || availableJobRoles.length === 0}
              className={cn(
                'h-9 w-full rounded-md border bg-background px-3 py-1 text-sm disabled:opacity-50',
                errors.job_role_id ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
              )}
            >
              <option value="">
                {!departmentId
                  ? 'Select department first'
                  : availableJobRoles.length === 0
                    ? 'No job roles available'
                    : 'Select job role'}
              </option>
              {availableJobRoles.map((jr) => {
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
            {errors.job_role_id && (
              <p className="ml-2 text-xs text-destructive">{errors.job_role_id.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="ml-2 text-sm font-medium">
            Line manager / Supervisor
          </label>
          <Popover open={managerOpen} onOpenChange={handleManagerOpenChange}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={managerOpen}
                className={cn(
                  'h-9 w-full justify-between font-normal focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!',
                  !selectedManager && 'text-muted-foreground'
                )}
              >
                <span className="truncate">
                  {selectedManager ? selectedManager.name : 'Select line manager'}
                </span>
                <ChevronDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
              <div className="border-b p-2">
                <div className="relative">
                  <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or job role..."
                    className="h-8 pl-8 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
                    value={managerSearch}
                    onChange={(e) => setManagerSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-auto p-1">
                <button
                  type="button"
                  className={cn(
                    'mb-2 flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-3 text-left text-sm hover:bg-accent',
                    !managerId && 'bg-accent'
                  )}
                  onClick={() => {
                    setValue('manager_id', '')
                    setManagerOpen(false)
                  }}
                >
                  <Avatar size="sm" className="size-8 shrink-0">
                    <AvatarFallback>
                      <UserIcon className="size-4" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-muted-foreground">None</span>
                </button>
                {filteredManagers.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No line manager found.
                  </p>
                ) : (
                  filteredManagers.map((manager) => {
                    const initials = manager.name
                      .split(/\s+/)
                      .map((s) => s[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)
                    const isSelected = managerId === manager.id
                    return (
                      <button
                        key={manager.id}
                        type="button"
                        className={cn(
                          'mb-2 flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent',
                          isSelected && 'bg-accent'
                        )}
                        onClick={() => {
                          setValue('manager_id', manager.id)
                          setManagerOpen(false)
                          setManagerSearch('')
                        }}
                      >
                        <Avatar size="sm" className="size-8 shrink-0">
                          {manager.avatarUrl ? (
                            <AvatarImage src={manager.avatarUrl} alt={manager.name} />
                          ) : null}
                          <AvatarFallback>{initials || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="truncate font-medium">{manager.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
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

        <div className="space-y-2">
          <label htmlFor="employee-report-location" className="ml-2 text-sm font-medium">
            Office location (optional)
          </label>
          <select
            id="employee-report-location"
            {...register('report_location')}
            className={cn(
              'h-9 w-full rounded-md border bg-background px-3 py-1 text-sm',
              errors.report_location
                ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
                : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
            )}
          >
            <option value="">None</option>
            {locations.map((loc) => {
              const parts: string[] = []
              if (loc.state) parts.push(loc.state)
              if (loc.address) {
                const addr = loc.address.length > 40 ? `${loc.address.slice(0, 40)}...` : loc.address
                parts.push(addr)
              }
              const display = parts.length > 0 ? parts.join(' - ') : `Location ${loc.id.slice(0, 8)}`
              return (
                <option key={loc.id} value={loc.id}>
                  {display}
                </option>
              )
            })}
          </select>
          {errors.report_location && (
            <p className="ml-2 text-xs text-destructive">{errors.report_location.message}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="employee-send-login"
            className="size-4 rounded border-input"
            aria-label="Send login details"
          />
          <label
            htmlFor="employee-send-login"
            className="cursor-pointer text-sm font-medium leading-none"
          >
            Send login details
          </label>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create employee'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function CreateEmployeeModal({
  open,
  onOpenChange,
  onSuccess,
  departments,
  jobRoles,
  lineManagerOptions,
  managerStats,
  locations,
}: CreateEmployeeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {open ? (
          <CreateEmployeeFormBody
            key="create-employee-form"
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
            departments={departments}
            jobRoles={jobRoles}
            lineManagerOptions={lineManagerOptions}
            managerStats={managerStats}
            locations={locations}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
