'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ChevronDownIcon, SearchIcon, UserIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { DepartmentRow } from '@/lib/data/departments'
import type { JobRoleRow } from '@/lib/data/job-roles'
import type { LocationRow } from '@/lib/data/locations'
import type { ManagerStats } from '@/lib/data/employees'
import type { LineManagerOption } from '@/components/dashboard/CreateEmployeeModal'
import { createSingleEmployee } from '@/lib/actions/employees'

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

const employeeSchema = z
  .object({
    staff_id: z.string().min(1, 'Staff ID is required').max(50, 'Staff ID is too long').trim(),
    firstname: z.string().min(1, 'First name is required').max(100, 'First name is too long').trim(),
    lastname: z.string().min(1, 'Last name is required').max(100, 'Last name is too long').trim(),
    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say'], { error: 'Gender is required' }),
    email: z.string().min(1, 'Email is required').email('Enter a valid email').trim(),
    phone: z.string().min(1, 'Phone number is required').max(20, 'Phone number is too long').trim(),
    contract_type: z.enum(
      ['permanent', 'part_time', 'fixed_term', 'temporary', 'intern', 'contractor'],
      { error: 'Contract type is required' }
    ),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().optional(),
    employment_status: z.enum(['probation', 'confirmed'], { error: 'Employment status is required' }),
    department_id: z.string().min(1, 'Department is required'),
    job_role_id: z.string().min(1, 'Job role is required'),
    manager_id: z.string().optional(),
    report_location: z.string().optional().or(z.literal('')),
    create_user_account: z.boolean(),
    user_first_name: z.string().optional(),
    user_last_name: z.string().optional(),
    user_email: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.contract_type === 'permanent' || data.contract_type === 'part_time') {
        return !data.end_date || data.end_date.trim() === ''
      }
      return !!data.end_date && data.end_date.trim() !== ''
    },
    { message: 'End date is required for fixed-term, temporary, intern, and contractor.', path: ['end_date'] }
  )
  .refine(
    (data) => {
      if (data.end_date && data.end_date.trim() !== '' && data.start_date) {
        return new Date(data.start_date) < new Date(data.end_date)
      }
      return true
    },
    { message: 'End date must be after start date', path: ['end_date'] }
  )
  .refine(
    (data) => {
      if (!data.create_user_account) return true
      return (
        (data.firstname ?? '').trim().length > 0 &&
        (data.lastname ?? '').trim().length > 0 &&
        (data.email ?? '').trim().length > 0 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((data.email ?? '').trim())
      )
    },
    { message: 'Employee name and email above are used for the invite.', path: ['email'] }
  )

type FormValues = z.infer<typeof employeeSchema>

type SingleEmployeeUploadFormProps = {
  departments: DepartmentRow[]
  jobRoles: JobRoleRow[]
  lineManagerOptions: LineManagerOption[]
  managerStats: ManagerStats
  locations: LocationRow[]
}

const inputErrorClass =
  'border-destructive focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary outline-none focus:border-primary'
const inputBaseClass = 'focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary outline-none focus:border-primary'

export function SingleEmployeeUploadForm({
  departments,
  jobRoles,
  lineManagerOptions,
  managerStats,
  locations,
}: SingleEmployeeUploadFormProps) {
  const router = useRouter()
  const [managerSearch, setManagerSearch] = useState('')
  const [managerOpen, setManagerOpen] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(employeeSchema),
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
      create_user_account: false,
      user_first_name: '',
      user_last_name: '',
      user_email: '',
    },
  })

  const { register, handleSubmit, setValue, control, formState: { errors, isSubmitting } } = form
  const contractType = useWatch({ control, name: 'contract_type', defaultValue: 'permanent' })
  const departmentId = useWatch({ control, name: 'department_id', defaultValue: '' })
  const managerId = useWatch({ control, name: 'manager_id', defaultValue: '' })
  const createUserAccount = useWatch({ control, name: 'create_user_account', defaultValue: false })

  const handleDepartmentChange = (value: string) => {
    setValue('department_id', value)
    setValue('job_role_id', '')
  }

  const availableJobRoles = jobRoles.filter((jr) => jr.department_id === departmentId)
  const activeDepartments = departments.filter((d) => d.is_active)

  const availableManagers = useMemo(
    () => lineManagerOptions.filter((m) => !managerStats.excludedIds.includes(m.id)),
    [lineManagerOptions, managerStats.excludedIds]
  )
  const topManagers = useMemo(() => {
    const topIds = new Set(managerStats.topManagers.map((m) => m.id))
    return availableManagers.filter((m) => topIds.has(m.id)).slice(0, 5)
  }, [availableManagers, managerStats.topManagers])
  const selectedManager = useMemo(
    () => availableManagers.find((m) => m.id === managerId),
    [availableManagers, managerId]
  )
  const filteredManagers = useMemo(() => {
    if (!managerSearch.trim()) return topManagers
    const q = managerSearch.trim().toLowerCase()
    return availableManagers.filter(
      (m) => m.name.toLowerCase().includes(q) || m.jobRoleDisplay.toLowerCase().includes(q)
    )
  }, [managerSearch, availableManagers, topManagers])

  const onSubmit = async (values: FormValues) => {
    const result = await createSingleEmployee({
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
      create_user_account: values.create_user_account,
      user_first_name: values.create_user_account ? values.firstname : undefined,
      user_last_name: values.create_user_account ? values.lastname : undefined,
      user_email: values.create_user_account ? values.email : undefined,
      roles: values.create_user_account ? ['employee'] : undefined,
    })

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success(
      values.create_user_account
        ? 'Employee added and invite sent successfully.'
        : 'Employee added successfully.'
    )
    form.reset()
    setValue('manager_id', '')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Card 1: Personal & contact */}
      <Card>
        <CardHeader>
          <CardTitle>Personal & contact</CardTitle>
          <CardDescription>Employee identity and contact information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="staff_id">Staff ID</Label>
              <Input
                id="staff_id"
                placeholder="e.g. EMP001"
                {...register('staff_id')}
                className={errors.staff_id ? inputErrorClass : inputBaseClass}
              />
              {errors.staff_id && (
                <p className="text-xs text-destructive">{errors.staff_id.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="employee@example.com"
                {...register('email')}
                className={errors.email ? inputErrorClass : inputBaseClass}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstname">First name</Label>
              <Input
                id="firstname"
                placeholder="e.g. Michael"
                {...register('firstname')}
                className={errors.firstname ? inputErrorClass : inputBaseClass}
              />
              {errors.firstname && (
                <p className="text-xs text-destructive">{errors.firstname.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastname">Last name</Label>
              <Input
                id="lastname"
                placeholder="e.g. Adeniji"
                {...register('lastname')}
                className={errors.lastname ? inputErrorClass : inputBaseClass}
              />
              {errors.lastname && (
                <p className="text-xs text-destructive">{errors.lastname.message}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                {...register('gender')}
                className={cn(
                  'h-9 w-full rounded-md border bg-background px-3 py-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary outline-none focus:border-primary',
                  errors.gender ? 'border-destructive' : ''
                )}
              >
                {GENDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {errors.gender && (
                <p className="text-xs text-destructive">{errors.gender.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                placeholder="e.g. +234 800 000 0000"
                {...register('phone')}
                className={errors.phone ? inputErrorClass : inputBaseClass}
              />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Employment */}
      <Card>
        <CardHeader>
          <CardTitle>Employment</CardTitle>
          <CardDescription>Contract, department, role, and reporting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contract_type">Contract type</Label>
              <select
                id="contract_type"
                {...register('contract_type')}
                className={cn(
                  'h-9 w-full rounded-md border bg-background px-3 py-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary outline-none focus:border-primary',
                  errors.contract_type ? 'border-destructive' : ''
                )}
              >
                {CONTRACT_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {errors.contract_type && (
                <p className="text-xs text-destructive">{errors.contract_type.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="employment_status">Employment status</Label>
              <select
                id="employment_status"
                {...register('employment_status')}
                className={cn(
                  'h-9 w-full rounded-md border bg-background px-3 py-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary outline-none focus:border-primary',
                  errors.employment_status ? 'border-destructive' : ''
                )}
              >
                {EMPLOYMENT_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {errors.employment_status && (
                <p className="text-xs text-destructive">{errors.employment_status.message}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start date</Label>
              <Input
                id="start_date"
                type="date"
                {...register('start_date')}
                className={errors.start_date ? inputErrorClass : inputBaseClass}
              />
              {errors.start_date && (
                <p className="text-xs text-destructive">{errors.start_date.message}</p>
              )}
            </div>
            {contractType !== 'permanent' && contractType !== 'part_time' && (
              <div className="space-y-2">
                <Label htmlFor="end_date">End date</Label>
                <Input
                  id="end_date"
                  type="date"
                  {...register('end_date')}
                  className={errors.end_date ? inputErrorClass : inputBaseClass}
                />
                {errors.end_date && (
                  <p className="text-xs text-destructive">{errors.end_date.message}</p>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="department_id">Department</Label>
              <select
                id="department_id"
                value={departmentId}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className={cn(
                  'h-9 w-full rounded-md border bg-background px-3 py-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary outline-none focus:border-primary',
                  errors.department_id ? 'border-destructive' : ''
                )}
              >
                <option value="">Select department</option>
                {activeDepartments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.code?.trim() ? `${dept.name} (${dept.code.trim()})` : dept.name}
                  </option>
                ))}
              </select>
              {errors.department_id && (
                <p className="text-xs text-destructive">{errors.department_id.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="job_role_id">Job role</Label>
              <select
                id="job_role_id"
                {...register('job_role_id')}
                disabled={!departmentId || availableJobRoles.length === 0}
                className={cn(
                  'h-9 w-full rounded-md border bg-background px-3 py-1 text-sm disabled:opacity-50 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary outline-none focus:border-primary',
                  errors.job_role_id ? 'border-destructive' : ''
                )}
              >
                <option value="">
                  {!departmentId ? 'Select department first' : availableJobRoles.length === 0 ? 'No job roles' : 'Select job role'}
                </option>
                {availableJobRoles.map((jr) => (
                  <option key={jr.id} value={jr.id}>
                    {jr.code?.trim() ? `${jr.name} (${jr.code.trim()})` : jr.name}
                  </option>
                ))}
              </select>
              {errors.job_role_id && (
                <p className="text-xs text-destructive">{errors.job_role_id.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Line manager</Label>
            <Popover open={managerOpen} onOpenChange={(o) => { setManagerOpen(o); if (!o) setManagerSearch('') }}>
              <PopoverTrigger asChild>
                {/* 07909872663 */}
                <Button
                  type="button"
                  variant="outline"
                  className={cn('w-full justify-between font-normal', !selectedManager && 'text-muted-foreground')}
                >
                  <span className="truncate">{selectedManager ? selectedManager.name : 'Select line manager'}</span>
                  <ChevronDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                <div className="border-b p-2">
                  <div className="relative">
                    <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or job role..."
                      className="h-8 pl-8"
                      value={managerSearch}
                      onChange={(e) => setManagerSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="max-h-64 overflow-auto p-1">
                  <button
                    type="button"
                    className={cn('flex w-full items-center gap-3 rounded-md px-2 py-3 text-left text-sm hover:bg-accent', !managerId && 'bg-accent')}
                    onClick={() => { setValue('manager_id', ''); setManagerOpen(false) }}
                  >
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback><UserIcon className="size-4" /></AvatarFallback>
                    </Avatar>
                    <span className="text-muted-foreground">None</span>
                  </button>
                  {filteredManagers.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">No line manager found.</p>
                  ) : (
                    filteredManagers.map((manager) => {
                      const initials = manager.name.split(/\s+/).map((s) => s[0]).join('').toUpperCase().slice(0, 2)
                      return (
                        <button
                          key={manager.id}
                          type="button"
                          className={cn(
                            'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent',
                            managerId === manager.id && 'bg-accent'
                          )}
                          onClick={() => { setValue('manager_id', manager.id); setManagerOpen(false); setManagerSearch('') }}
                        >
                          <Avatar className="size-8 shrink-0">
                            {manager.avatarUrl && <AvatarImage src={manager.avatarUrl} alt={manager.name} />}
                            <AvatarFallback>{initials || '?'}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="truncate font-medium">{manager.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{manager.jobRoleDisplay}</p>
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
            <Label htmlFor="report_location">Office location (optional)</Label>
            <select
              id="report_location"
              {...register('report_location')}
              className="h-9 w-full rounded-md border bg-background px-3 py-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary outline-none focus:border-primary"
            >
              <option value="">None</option>
              {locations.map((loc) => {
                const display = [loc.state, loc.address].filter(Boolean).join(' - ') || `Location ${loc.id.slice(0, 8)}`
                return (
                  <option key={loc.id} value={loc.id}>{display}</option>
                )
              })}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: User account (optional) */}
      <Card>
        <CardHeader>
          <CardTitle>User account</CardTitle>
          <CardDescription>
            Optionally create a login account for this employee. They will receive an invite to set their password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="create_user_account"
              className="size-4 rounded border-input"
              {...register('create_user_account')}
            />
            <Label htmlFor="create_user_account" className="cursor-pointer font-normal">
              Send invite to employee
            </Label>
          </div>
          {/* {createUserAccount && (
            <p className="text-sm text-muted-foreground">
              Profile and invite will use the employee name and email above with the Employee role.
            </p>
          )} */}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting…' : 'Add employee'}
        </Button>
      </div>
      <p>
      </p>
    </form>
  )
}


