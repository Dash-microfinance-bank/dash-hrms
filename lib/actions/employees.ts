'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx

  const staffId = input.staff_id.trim()
  const email = input.email.trim().toLowerCase()
  const phone = input.phone.trim()
  const firstname = input.firstname.trim()
  const lastname = input.lastname.trim()

  if (!staffId) {
    return { success: false, error: 'Staff ID is required' }
  }

  if (!email) {
    return { success: false, error: 'Email is required' }
  }

  if (!firstname) {
    return { success: false, error: 'First name is required' }
  }

  if (!lastname) {
    return { success: false, error: 'Last name is required' }
  }

  if (!phone) {
    return { success: false, error: 'Phone number is required' }
  }

  if (!input.start_date) {
    return { success: false, error: 'Start date is required' }
  }

  if (!input.department_id) {
    return { success: false, error: 'Department is required' }
  }

  if (!input.job_role_id) {
    return { success: false, error: 'Job role is required' }
  }

  // Uniqueness: no two employees in the same org can share staff_id, email, or phone
  const { data: existingByStaffId } = await supabase
    .from('employees')
    .select('id')
    .eq('organization_id', orgId)
    .eq('staff_id', staffId)
    .limit(1)
    .maybeSingle()

  if (existingByStaffId) {
    return { success: false, error: 'A staff ID with this value already exists in your organization' }
  }

  const { data: existingByEmail } = await supabase
    .from('employees')
    .select('id')
    .eq('organization_id', orgId)
    .ilike('email', email)
    .limit(1)
    .maybeSingle()

  if (existingByEmail) {
    return { success: false, error: 'An employee with this email already exists in your organization' }
  }

  const { data: existingByPhone } = await supabase
    .from('employees')
    .select('id')
    .eq('organization_id', orgId)
    .eq('phone', phone)
    .limit(1)
    .maybeSingle()

  if (existingByPhone) {
    return { success: false, error: 'An employee with this phone number already exists in your organization' }
  }

  // Validate department belongs to same org
  const { data: department, error: deptError } = await supabase
    .from('departments')
    .select('id, organization_id, is_active')
    .eq('id', input.department_id)
    .single()

  if (deptError || !department) {
    return { success: false, error: 'Selected department was not found' }
  }

  if (department.organization_id !== orgId) {
    return {
      success: false,
      error: 'You can only assign employees to departments in your organization',
    }
  }

  if (department.is_active === false) {
    return {
      success: false,
      error: 'You cannot assign an employee to an inactive department',
    }
  }

  // Validate job role belongs to same org and department
  const { data: jobRole, error: jobRoleError } = await supabase
    .from('job_roles')
    .select('id, organization_id, department_id')
    .eq('id', input.job_role_id)
    .single()

  if (jobRoleError || !jobRole) {
    return { success: false, error: 'Selected job role was not found' }
  }

  if (jobRole.organization_id !== orgId) {
    return {
      success: false,
      error: 'You can only assign employees to job roles in your organization',
    }
  }

  if (jobRole.department_id !== input.department_id) {
    return {
      success: false,
      error: 'Selected job role does not belong to the selected department',
    }
  }

  // Validate end_date: permanent and part_time should not have end_date
  if ((input.contract_type === 'permanent' || input.contract_type === 'part_time') && input.end_date) {
    return {
      success: false,
      error: 'End date should not be set for permanent or part-time employees',
    }
  }

  // All other contract types require end_date
  if (input.contract_type !== 'permanent' && input.contract_type !== 'part_time' && !input.end_date) {
    return {
      success: false,
      error: 'End date is required for fixed-term, temporary, intern, and contractor contracts',
    }
  }

  // Validate manager_id if provided (must be same org employee)
  if (input.manager_id) {
    const { data: manager, error: managerError } = await supabase
      .from('employees')
      .select('id, organization_id')
      .eq('id', input.manager_id)
      .single()
    if (managerError || !manager) {
      return { success: false, error: 'Selected line manager was not found' }
    }
    if (manager.organization_id !== orgId) {
      return { success: false, error: 'Line manager must be from your organization' }
    }
  }

  // Create employee record
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
    })
    .select('id')
    .single()

  if (employeeError) {
    const msg = employeeError.message.toLowerCase()
    if (msg.includes('employees_org_staff_id_key')) {
      return { success: false, error: 'A staff ID with this value already exists in your organization' }
    }
    return { success: false, error: employeeError.message }
  }

  // Create biodata record
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

  revalidatePath(EMPLOYEES_PATH)
  return { success: true }
}
