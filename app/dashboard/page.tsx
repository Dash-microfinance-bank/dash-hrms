import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar/Employee'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Building2, CalendarDays, Hourglass, IdCard, MapPin, UserCircle2 } from 'lucide-react'
import { getEmployeesForCurrentOrg } from '@/lib/data/employees'
import { EmployeeQuickList, type EmployeeQuickInfo } from '@/components/dashboard/EmployeeQuickList'

/**
 * Default dashboard entry: redirects logged-in users to the area that matches their role.
 * - super_admin → /dashboard/system
 * - hr or finance → /dashboard/admin
 * - others (employee, manager, etc.) → stay here (Employee self service)
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Must be authenticated
  if (!user) {
    redirect('/auth/login')
  }

  // Resolve profile + organization (multi-tenant guard)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.organization_id) {
    // No org / profile → no access to employee dashboard
    redirect('/dashboard/admin')
  }

  const orgId = profile.organization_id as string

  // Roles scoped to this organization
  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)

  if (!rolesError && roles?.length) {
    const roleList = roles.map((r) => r.role as string)

    // Only users with the "employee" role can access this page
    if (!roleList.includes('employee')) {
      redirect('/dashboard/admin')
    }
  } else {
    // If we cannot determine roles, do not allow access to employee dashboard
    redirect('/dashboard/admin')
  }

  // Ensure there is an employee record linked to this auth user in this org
  const employees = await getEmployeesForCurrentOrg()
  const employee = employees.find((emp) => emp.auth_id === user.id)

  if (!employee) {
    // No matching employee record; redirect out of employee dashboard
    redirect('/dashboard/admin')
  }

  // ── Derived display values for header card ───────────────────────────────────
  const avatarUrl = employee.avatar_url ?? ((profile.avatar_url as string | null) ?? null)
  const initials =
    ((employee.biodata_firstname?.[0] ?? '') + (employee.biodata_lastname?.[0] ?? '')).toUpperCase() ||
    (employee.email?.[0] ?? '?').toUpperCase()

  const employeeName = (() => {
    const parts: string[] = []
    if (employee.biodata_firstname) parts.push(employee.biodata_firstname)
    if (employee.biodata_lastname) parts.push(employee.biodata_lastname)
    if (parts.length === 0) return employee.email
    return parts.join(' ')
  })()

  const jobTitle = employee.job_role_title ?? '—'

  const departmentLabel = (() => {
    const name = employee.department_name ?? ''
    const code = employee.department_code?.trim() ?? ''
    if (!name && !code) return '—'
    return code ? `${name} (${code})` : name
  })()

  const staffId = employee.staff_id || '—'

  const managerName = (() => {
    if (!employee.manager_id) return 'Not assigned'
    const manager = employees.find((e) => e.id === employee.manager_id)
    if (!manager) return 'Not assigned'
    const parts: string[] = []
    if (manager.biodata_firstname) parts.push(manager.biodata_firstname)
    if (manager.biodata_lastname) parts.push(manager.biodata_lastname)
    if (parts.length === 0) return manager.email
    return parts.join(' ')
  })()

  // Office report location from organization_location (scoped to org)
  let reportLocation = '—'
  if (employee.report_location) {
    const { data: locRow } = await supabase
      .from('organization_location')
      .select('state, address')
      .eq('id', employee.report_location)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (locRow) {
      const parts: string[] = []
      if ((locRow as { state?: string | null }).state) {
        parts.push((locRow as { state?: string | null }).state as string)
      }
      const addr = (locRow as { address?: string | null }).address
      if (addr) {
        const safeAddr = addr as string
        parts.push(safeAddr.length > 40 ? `${safeAddr.slice(0, 40)}...` : safeAddr)
      }
      if (parts.length > 0) {
        reportLocation = parts.join(' - ')
      }
    }
  }

  let workAnniversaryDisplay = '—'
  let timeInCompanyDisplay = '—'

  if (employee.start_date) {
    const start = new Date(employee.start_date)

    if (!Number.isNaN(start.getTime())) {
      workAnniversaryDisplay = start.toLocaleDateString('en-NG', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })

      const now = new Date()
      let months =
        (now.getFullYear() - start.getFullYear()) * 12 +
        (now.getMonth() - start.getMonth())

      if (now.getDate() < start.getDate()) {
        months -= 1
      }

      if (months < 0) {
        months = 0
      }

      const years = Math.floor(months / 12)
      const remainingMonths = months % 12

      const yearLabel = years === 1 ? 'year' : 'years'
      const monthLabel = remainingMonths === 1 ? 'month' : 'months'

      if (years === 0 && remainingMonths === 0) {
        timeInCompanyDisplay = 'Less than a month'
      } else if (years === 0) {
        timeInCompanyDisplay = `${remainingMonths} ${monthLabel}`
      } else if (remainingMonths === 0) {
        timeInCompanyDisplay = `${years} ${yearLabel}`
      } else {
        timeInCompanyDisplay = `${years} ${yearLabel}, ${remainingMonths} ${monthLabel}`
      }
    }
  }

  // ── Upcoming birthdays & work anniversaries (top 5 each) ─────────────────────
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const employeeById = new Map(employees.map((e) => [e.id, e]))

  type HighlightRow = {
    id: string
    name: string
    date: Date
    displayDate: string
    avatarUrl: string | null
  }

  const getInitials = (fullName: string | null, email: string): string => {
    if (fullName) {
      const parts = fullName.trim().split(/\s+/)
      if (parts.length > 0) {
        return parts
          .slice(0, 2)
          .map((p) => p[0]?.toUpperCase() ?? '')
          .join('') || '?'
      }
    }
    return (email[0] ?? '?').toUpperCase()
  }

  const upcomingBirthdays: HighlightRow[] = []

  const { data: birthdayRows } = await supabase
    .from('employee_biodata')
    .select('employee_id, firstname, lastname, date_of_birth')
    .eq('organization_id', orgId)

  for (const row of (birthdayRows ?? []) as Array<{
    employee_id: string
    firstname: string | null
    lastname: string | null
    date_of_birth: string | null
  }>) {
    if (!row.date_of_birth) continue
    const emp = employeeById.get(row.employee_id)
    if (!emp || !emp.active) continue

    const dob = new Date(row.date_of_birth)
    if (Number.isNaN(dob.getTime())) continue

    const next = new Date(today)
    next.setMonth(dob.getMonth(), dob.getDate())
    if (next < today) {
      next.setFullYear(next.getFullYear() + 1)
    }

    upcomingBirthdays.push({
      id: emp.id,
      name: `${row.firstname ?? ''} ${row.lastname ?? ''}`.trim() || emp.email,
      date: next,
      displayDate: next.toLocaleDateString('en-NG', {
        day: '2-digit',
        month: 'long',
      }),
      avatarUrl: emp.avatar_url,
    })
  }

  upcomingBirthdays.sort((a, b) => a.date.getTime() - b.date.getTime())
  const topBirthdays = upcomingBirthdays.slice(0, 5)

  const birthdayByEmployeeId = new Map<string, string | null>()
  for (const row of (birthdayRows ?? []) as Array<{ employee_id: string; date_of_birth: string | null }>) {
    birthdayByEmployeeId.set(row.employee_id, row.date_of_birth)
  }

  const upcomingAnniversaries: HighlightRow[] = []

  for (const emp of employees) {
    if (!emp.active || !emp.start_date) continue
    const start = new Date(emp.start_date)
    if (Number.isNaN(start.getTime())) continue

    const next = new Date(today)
    next.setMonth(start.getMonth(), start.getDate())
    if (next < today) {
      next.setFullYear(next.getFullYear() + 1)
    }

    const nameParts: string[] = []
    if (emp.biodata_firstname) nameParts.push(emp.biodata_firstname)
    if (emp.biodata_lastname) nameParts.push(emp.biodata_lastname)
    const name = nameParts.join(' ') || emp.email

    upcomingAnniversaries.push({
      id: emp.id,
      name,
      date: next,
      displayDate: next.toLocaleDateString('en-NG', {
        day: '2-digit',
        month: 'long',
      }),
      avatarUrl: emp.avatar_url,
    })
  }

  upcomingAnniversaries.sort((a, b) => a.date.getTime() - b.date.getTime())
  const topAnniversaries = upcomingAnniversaries.slice(0, 5)

  // ── Precompute location labels for quick list ────────────────────────────────
  const { data: locationRows } = await supabase
    .from('organization_location')
    .select('id, state, address')
    .eq('organization_id', orgId)

  const locationById = new Map<string, string>()
  for (const loc of (locationRows ?? []) as Array<{ id: string; state: string | null; address: string | null }>) {
    const parts: string[] = []
    if (loc.state) parts.push(loc.state)
    if (loc.address) {
      const addr = loc.address
      parts.push(addr.length > 40 ? `${addr.slice(0, 40)}...` : addr)
    }
    locationById.set(
      loc.id,
      parts.length > 0 ? parts.join(' - ') : `Location ${loc.id.slice(0, 8)}`
    )
  }

  const quickEmployees: EmployeeQuickInfo[] = employees.map((emp) => {
    const nameParts: string[] = []
    if (emp.biodata_firstname) nameParts.push(emp.biodata_firstname)
    if (emp.biodata_lastname) nameParts.push(emp.biodata_lastname)
    const name = nameParts.join(' ') || emp.email

    const deptName = emp.department_name ?? ''
    const deptCode = emp.department_code?.trim() ?? ''
    const department =
      deptName || deptCode
        ? deptCode
          ? `${deptName} (${deptCode})`
          : deptName
        : '—'

    const jobTitleLabel = emp.job_role_title ?? '—'
    const staffIdLabel = emp.staff_id || '—'
    const reportLocationLabel =
      emp.report_location ? locationById.get(emp.report_location) ?? '—' : '—'

    const mgr = emp.manager_id
      ? employees.find((e) => e.id === emp.manager_id)
      : null
    let mgrName = 'Not assigned'
    if (mgr) {
      const mParts: string[] = []
      if (mgr.biodata_firstname) mParts.push(mgr.biodata_firstname)
      if (mgr.biodata_lastname) mParts.push(mgr.biodata_lastname)
      mgrName = mParts.join(' ') || mgr.email
    }

    return {
      id: emp.id,
      name,
      email: emp.email,
      avatarUrl: emp.avatar_url,
      department,
      jobTitle: jobTitleLabel,
      staffId: staffIdLabel,
      reportLocation: reportLocationLabel,
      managerName: mgrName,
      startDate: emp.start_date,
      birthday: birthdayByEmployeeId.get(emp.id) ?? null,
    }
  })

  return (
    <div className="">
      <Navbar />
      <section className="p-4 lg:px-20 px-3">
        {/* <h1 className="text-2xl font-bold">Welcome to the dashboard</h1> */}
        <section className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 gap-x-8 gap-y-12 mt-6">
          <div className='col-span-4 lg:col-span-1'>
            <Card className='col-span-4 lg:col-span-1 border-slate-200 shadow-none'>
              <CardHeader className='p-4 bg-primary py-6 rounded-t-xl'>
                <div className='flex items-center gap-2'>
                  <Avatar className='size-16'>
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt={employeeName} className='object-cover rounded-full' /> : null}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className='flex flex-col text-left space-y-0'>
                    <CardTitle className='text-white text-lg'>{employeeName}</CardTitle>
                    <CardDescription className='text-sm text-white/80'>
                      {jobTitle}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className='space-y-5 pt-6 bg-slate-100 rounded-b-xl'>
                <div className='flex items-center gap-2'>
                  <div className='flex items-center gap-2 bg-primary rounded-full p-2'>
                    <Building2 className='size-4 text-white' />
                  </div>
                  <div className='flex flex-col text-left space-y-0'>
                    <span className='text-xs text-muted-foreground'>Department</span>
                    <span className='text-sm font-medium'>{departmentLabel}</span>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  <div className='flex items-center gap-2 bg-primary rounded-full p-2'>
                    <IdCard className='size-4 text-white' />
                  </div>
                  <div className='flex flex-col text-left space-y-0'>
                    <span className='text-xs text-muted-foreground'>Staff ID</span>
                    <span className='text-sm font-medium'>{staffId}</span>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  <div className='flex items-center gap-2 bg-primary rounded-full p-2'>
                    <UserCircle2 className='size-4 text-white' />
                  </div>
                  <div className='flex flex-col text-left space-y-0'>
                    <span className='text-xs text-muted-foreground'>Line manager / Supervisor</span>
                    <span className='text-sm font-medium'>{managerName}</span>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  <div className='flex items-center gap-2 bg-primary rounded-full p-2'>
                    <MapPin className='size-4 text-white' />
                  </div>
                  <div className='flex flex-col text-left space-y-0'>
                    <span className='text-xs text-muted-foreground'>Report Location</span>
                    <span className='text-sm font-medium'>{reportLocation}</span>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  <div className='flex items-center gap-2 bg-primary rounded-full p-2'>
                    <CalendarDays className='size-4 text-white' />
                  </div>
                  <div className='flex flex-col text-left space-y-0'>
                    <span className='text-xs text-muted-foreground'>Work anniversary</span>
                    <span className='text-sm font-medium'>{workAnniversaryDisplay}</span>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  <div className='flex items-center gap-2 bg-primary rounded-full p-2'>
                    <Hourglass className='size-4 text-white' />
                  </div>
                  <div className='flex flex-col text-left space-y-0'>
                    <span className='text-xs text-muted-foreground'>Time in company</span>
                    <span className='text-sm font-medium'>{timeInCompanyDisplay}</span>
                  </div>
                </div>
              </CardContent>  
            </Card>
          </div>
          <div className='col-span-4 lg:col-span-3'>
            <Card className='border-slate-200 shadow-none p-0'>
              <CardHeader className='p-4 bg-primary py-6 rounded-t-xl'>
                <CardTitle className='text-white text-lg text-center'>Upcoming events</CardTitle>
              </CardHeader>
              <CardContent className='grid grid-cols-1 md:grid-cols-3 gap-0 p-0 md:divide-x md:divide-slate-200 pb-'>
                <Card className='shadow-none m-0 rounded-none border-r-0 border-l-0 border-t-0 border-b lg:border-b-0 bg-transparent! h-80 px-4'>
                  <CardHeader className='p-3 border-b border-slate-200'>
                    <CardTitle className='text-lg text-center'>Birthdays</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-4 pt-4'>
                    {topBirthdays.length === 0 ? (
                      <p className='text-center text-sm text-muted-foreground'>
                        No upcoming birthdays.
                      </p>
                    ) : (
                      topBirthdays.map((b) => {
                        const initials = getInitials(b.name, employee.email)
                        return (
                          <div key={b.id} className='flex items-center gap-2'>
                            <Avatar className='size-8'>
                              {b.avatarUrl ? <AvatarImage src={b.avatarUrl} alt={b.name} className='object-cover' /> : null}
                              <AvatarFallback>{initials}</AvatarFallback>
                            </Avatar>
                            <div className='flex flex-col text-left space-y-0'>
                              <CardTitle className='text-sm'>{b.name}</CardTitle>
                              <CardDescription className='text-xs'>{b.displayDate}</CardDescription>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </CardContent>
                </Card>
                <Card className='shadow-none m-0 rounded-none lg:border-r lg:border-l border-t-0 border-b lg:border-b-0 bg-transparent! h-80 px-4'>
                  <CardHeader className='p-3 border-b border-slate-200'>
                    <CardTitle className='text-lg text-center'>Holidays</CardTitle>
                  </CardHeader>
                  <CardContent className='pt-4'>
                    <p className='text-center text-sm text-muted-foreground'>No holidays scheduled for this month</p>
                  </CardContent>
                </Card>
                <Card className='shadow-none m-0 rounded-none border-r-0 border-l-0 border-t-0 border-b-0 bg-transparent! h-80 px-4'>
                  <CardHeader className='p-3 border-b border-slate-200'>
                    <CardTitle className='text-lg text-center'>Work Anniversaries</CardTitle>
                  </CardHeader>
                  <CardContent className='pt-4 space-y-4'>
                    {topAnniversaries.length === 0 ? (
                      <p className='text-center text-sm text-muted-foreground'>
                        No upcoming work anniversaries.
                      </p>
                    ) : (
                      topAnniversaries.map((a) => {
                        const initials = getInitials(a.name, employee.email)
                        return (
                          <div key={a.id} className='flex items-center gap-2'>
                            <Avatar className='size-8'>
                              {a.avatarUrl ? <AvatarImage src={a.avatarUrl} alt={a.name} className='object-cover' /> : null}
                              <AvatarFallback>{initials}</AvatarFallback>
                            </Avatar>
                            <div className='flex flex-col text-left space-y-0'>
                              <CardTitle className='text-sm'>{a.name}</CardTitle>
                              <CardDescription className='text-xs'>{a.displayDate}</CardDescription>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
            <div className='mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4'>
              <div className='col-span-1'>
                <Card className='border-slate-200 shadow-none p-0'>
                  <CardHeader className='p-4 bg-primary py-4 rounded-t-xl'>
                    <CardTitle className='text-white text-lg text-center'>All Employees</CardTitle>
                  </CardHeader>
                  <CardContent className='py-3'>
                    <EmployeeQuickList employees={quickEmployees} />
                  </CardContent>
                </Card>
              </div>
              <div className='col-span-1'>
                <Card className='border-slate-200 shadow-none p-0 h-[500px]'>
                  <CardHeader className='p-4 bg-primary py-4 rounded-t-xl'>
                    <CardTitle className='text-white text-lg text-center'>Anouncements</CardTitle>
                  </CardHeader>
                  <CardContent className='py-3' >
                    <p className='text-center text-sm text-muted-foreground'>No announcements found</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </section>
      <footer className='mx-12 mt -12'>
        <div className='flex items-center justify-center py-5'>
          <p className='text-sm text-muted-foreground'>© 2026 Dash technologies LTD. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
