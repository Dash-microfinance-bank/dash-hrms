'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_ROLES = ['super_admin', 'hr', 'finance'] as const

export type EmployeeActionResult =
  | { success: true }
  | { success: false; error: string }

type CreateEmployeeInput = {
  staff_id: string
  firstname: string
  lastname: string
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say'
  email: string
  phone: string
  contract_type: 'permanent' | 'part_time' | 'fixed_term' | 'temporary' | 'intern' | 'contractor'
  start_date: string
  end_date?: string | null
  employment_status: 'probation' | 'confirmed'
  department_id: string
  job_role_id: string
  manager_id?: string | null
  report_location?: string | null
}

type CreateSingleEmployeeInput = CreateEmployeeInput & {
  create_user_account: boolean
  user_first_name?: string
  user_last_name?: string
  user_email?: string
  roles?: string[]
}

const EMPLOYEES_PATH = '/dashboard/admin/employees'

async function getAdminContext() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' } as const
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return { error: 'Organization not found' } as const
  }

  const orgId = profile.organization_id

  const { data: rolesData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)

  const roles = (rolesData ?? []).map((r) => r.role as string)
  const hasAdminRole = roles.some((r) => ADMIN_ROLES.includes(r as (typeof ADMIN_ROLES)[number]))

  if (!hasAdminRole) {
    return { error: 'You do not have permission to manage employees' } as const
  }

  return {
    supabase,
    user,
    orgId,
  } as {
    supabase: typeof supabase
    user: typeof user
    orgId: string
  }
}

export async function createEmployee(input: CreateEmployeeInput): Promise<EmployeeActionResult> {
  return createSingleEmployee({ ...input, create_user_account: false })
}

export async function createSingleEmployee(
  input: CreateSingleEmployeeInput
): Promise<EmployeeActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const { supabase, orgId } = ctx

  const staffId = input.staff_id.trim()
  const email = input.email.trim().toLowerCase()
  const phone = input.phone.trim()
  const firstname = input.firstname.trim()
  const lastname = input.lastname.trim()

  if (!staffId) return { success: false, error: 'Staff ID is required' }
  if (!email) return { success: false, error: 'Email is required' }
  if (!firstname) return { success: false, error: 'First name is required' }
  if (!lastname) return { success: false, error: 'Last name is required' }
  if (!phone) return { success: false, error: 'Phone number is required' }
  if (!input.start_date) return { success: false, error: 'Start date is required' }
  if (!input.department_id) return { success: false, error: 'Department is required' }
  if (!input.job_role_id) return { success: false, error: 'Job role is required' }

  // Uniqueness checks
  const [existingStaff, existingEmail, existingPhone] = await Promise.all([
    supabase.from('employees').select('id').eq('organization_id', orgId).eq('staff_id', staffId).limit(1).maybeSingle(),
    supabase.from('employees').select('id').eq('organization_id', orgId).ilike('email', email).limit(1).maybeSingle(),
    supabase.from('employees').select('id').eq('organization_id', orgId).eq('phone', phone).limit(1).maybeSingle(),
  ])
  if (existingStaff.data) return { success: false, error: 'A staff ID with this value already exists in your organization' }
  if (existingEmail.data) return { success: false, error: 'An employee with this email already exists in your organization' }
  if (existingPhone.data) return { success: false, error: 'An employee with this phone number already exists in your organization' }

  // Validate department
  const { data: department, error: deptError } = await supabase.from('departments').select('id, organization_id, is_active').eq('id', input.department_id).single()
  if (deptError || !department) return { success: false, error: 'Selected department was not found' }
  if (department.organization_id !== orgId) return { success: false, error: 'You can only assign employees to departments in your organization' }
  if (department.is_active === false) return { success: false, error: 'You cannot assign an employee to an inactive department' }

  // Validate job role
  const { data: jobRole, error: jobRoleError } = await supabase.from('job_roles').select('id, organization_id, department_id').eq('id', input.job_role_id).single()
  if (jobRoleError || !jobRole) return { success: false, error: 'Selected job role was not found' }
  if (jobRole.organization_id !== orgId) return { success: false, error: 'You can only assign employees to job roles in your organization' }
  if (jobRole.department_id !== input.department_id) return { success: false, error: 'Selected job role does not belong to the selected department' }

  // Contract / end_date rules
  if ((input.contract_type === 'permanent' || input.contract_type === 'part_time') && input.end_date) {
    return { success: false, error: 'End date should not be set for permanent or part-time employees' }
  }
  if (input.contract_type !== 'permanent' && input.contract_type !== 'part_time' && !input.end_date) {
    return { success: false, error: 'End date is required for fixed-term, temporary, intern, and contractor contracts' }
  }

  // Validate manager
  if (input.manager_id) {
    const { data: manager, error: managerError } = await supabase.from('employees').select('id, organization_id').eq('id', input.manager_id).single()
    if (managerError || !manager) return { success: false, error: 'Selected line manager was not found' }
    if (manager.organization_id !== orgId) return { success: false, error: 'Line manager must be from your organization' }
  }

  // Validate location
  if (input.report_location) {
    const { data: location, error: locationError } = await supabase.from('organization_location').select('id, organization_id').eq('id', input.report_location).single()
    if (locationError || !location) return { success: false, error: 'Selected office location was not found' }
    if (location.organization_id !== orgId) return { success: false, error: 'Office location must belong to your organization' }
  }

  // If creating a user account, validate the user email is not already registered
  if (input.create_user_account) {
    const userEmail = (input.user_email ?? '').trim().toLowerCase()
    if (!userEmail) return { success: false, error: 'A valid email is required to create a user account' }

    const adminCheck = createAdminClient()
    const { data: authUserId } = await adminCheck.rpc('find_auth_user_id_by_email', { p_email: userEmail })
    if (authUserId) return { success: false, error: 'A user account with this email already exists' }
  }

  // ── Insert employee ──────────────────────────────────────────────────────
  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .insert({
      organization_id: orgId,
      staff_id: staffId,
      email,
      phone,
      contract_type: input.contract_type,
      start_date: input.start_date,
      end_date: input.end_date || null,
      employment_status: input.employment_status,
      department_id: input.department_id,
      job_role_id: input.job_role_id,
      manager_id: input.manager_id || null,
      report_location: input.report_location || null,
    })
    .select('id')
    .single()

  if (employeeError) {
    const msg = employeeError.message.toLowerCase()
    if (msg.includes('employees_org_staff_id_key')) return { success: false, error: 'A staff ID with this value already exists in your organization' }
    return { success: false, error: employeeError.message }
  }

  // ── Insert biodata ───────────────────────────────────────────────────────
  const { error: biodataError } = await supabase.from('employee_biodata').insert({
    employee_id: employee.id,
    organization_id: orgId,
    firstname,
    lastname,
    gender: input.gender,
  })

  if (biodataError) {
    console.error('[Employees] Failed to create biodata:', biodataError)
  }

  // ── Create user account (optional) ──────────────────────────────────────
  if (input.create_user_account) {
    const userEmail = (input.user_email ?? '').trim().toLowerCase()
    const userFirst = (input.user_first_name ?? firstname).trim()
    const userLast = (input.user_last_name ?? lastname).trim()
    const fullName = [userFirst, userLast].filter(Boolean).join(' ') || null
    const roles = (input.roles ?? []).length > 0 ? input.roles! : ['employee']

    let adminClient
    try {
      adminClient = createAdminClient()
    } catch (err) {
      // Employee created; cleanup and surface config error
      await supabase.from('employees').delete().eq('id', employee.id)
      const message = err instanceof Error ? err.message : 'Server configuration error'
      return { success: false, error: message }
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      userEmail,
      {
        redirectTo: `${baseUrl}/auth/callback`,
        data: { full_name: fullName ?? undefined, name: fullName ?? undefined },
      }
    )

    if (inviteError) {
      await supabase.from('employees').delete().eq('id', employee.id)
      const msg = inviteError.message.toLowerCase()
      if (msg.includes('already') || msg.includes('already registered') || msg.includes('already exists')) {
        return { success: false, error: 'A user account with this email already exists.' }
      }
      return { success: false, error: `Employee could not be created: ${inviteError.message}` }
    }

    const invitedUser = inviteData?.user
    if (!invitedUser?.id) {
      await supabase.from('employees').delete().eq('id', employee.id)
      return { success: false, error: 'Invite succeeded but user ID was not returned' }
    }

    // Insert profile
    const { error: profileError } = await supabase.from('profiles').insert({
      id: invitedUser.id,
      organization_id: orgId,
      full_name: fullName,
      avatar_url: null,
    })

    if (profileError) {
      await adminClient.auth.admin.deleteUser(invitedUser.id)
      await supabase.from('employees').delete().eq('id', employee.id)
      return { success: false, error: profileError.message }
    }

    // Insert roles
    const { error: rolesError } = await supabase.from('user_roles').insert(
      roles.map((role) => ({ user_id: invitedUser.id, role, organization_id: orgId }))
    )

    if (rolesError) {
      await supabase.from('profiles').delete().eq('id', invitedUser.id)
      await adminClient.auth.admin.deleteUser(invitedUser.id)
      await supabase.from('employees').delete().eq('id', employee.id)
      return { success: false, error: rolesError.message }
    }

    console.log('[createSingleEmployee] ✅ Auth account created for employee:', userEmail)
  }

  revalidatePath(EMPLOYEES_PATH)
  return { success: true }
}

export async function exitEmployee(employeeId: string): Promise<EmployeeActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const { supabase, orgId } = ctx

  // 1. Fetch the employee — verify it belongs to this org
  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id, email, active')
    .eq('id', employeeId)
    .eq('organization_id', orgId)
    .single()

  if (empError || !employee) return { success: false, error: 'Employee not found' }

  // 2. Mark the employee as inactive
  const { error: deactivateError } = await supabase
    .from('employees')
    .update({ active: false })
    .eq('id', employeeId)
    .eq('organization_id', orgId)

  if (deactivateError) return { success: false, error: `Failed to deactivate employee: ${deactivateError.message}` }

  // 3. Find the auth user ID via the service-role-only RPC
  const adminClient = createAdminClient()

  const { data: authUserId, error: rpcError } = await adminClient
    .rpc('find_auth_user_id_by_email', { p_email: employee.email })

  if (rpcError) {
    console.error('[exitEmployee] RPC error:', rpcError.message)
    // Employee is already deactivated; auth cleanup failed but not fatal enough to roll back
    revalidatePath(EMPLOYEES_PATH)
    return { success: false, error: `Employee deactivated but auth account could not be located: ${rpcError.message}` }
  }

  if (!authUserId) {
    // No auth account found (employee may never have had login access)
    revalidatePath(EMPLOYEES_PATH)
    return { success: true }
  }

  // 4. Delete the profile row (cascades to user_roles etc. depending on FK constraints)
  const { error: profileError } = await adminClient
    .from('profiles')
    .delete()
    .eq('id', authUserId)

  if (profileError) {
    console.error('[exitEmployee] Profile delete error:', profileError.message)
  }

  // 5. Delete the auth user — revokes all sessions and login access permanently
  const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(authUserId)

  if (authDeleteError) {
    console.error('[exitEmployee] Auth delete error:', authDeleteError.message)
    revalidatePath(EMPLOYEES_PATH)
    return { success: false, error: `Employee deactivated but auth account could not be deleted: ${authDeleteError.message}` }
  }

  revalidatePath(EMPLOYEES_PATH)
  return { success: true }
}
