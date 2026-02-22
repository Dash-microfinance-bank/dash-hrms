import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ChangeEvent {
  id: string
  source_table: 'employees' | 'employee_biodata'
  field: string
  old_value: unknown
  new_value: unknown
  requested_by: string
  requester_name: string | null
  status: 'applied' | 'pending_approval' | 'rejected'
  reason: string | null
  created_at: string
}

export interface Employee360Employee {
  id: string
  organization_id: string
  staff_id: string
  email: string
  phone: string | null
  contract_type: string
  start_date: string | null
  end_date: string | null
  employment_status: string
  active: boolean
  created_at: string
  department_id: string
  job_role_id: string
  manager_id: string | null
  report_location: string | null
  department_name: string | null
  department_code: string | null
  job_role_title: string | null
  job_role_code: string | null
  manager_name: string | null
  location_address: string | null
}

export interface Employee360Biodata {
  title: string | null
  firstname: string | null
  lastname: string | null
  othernames: string | null
  mothers_maiden_name: string | null
  marital_status: string | null
  gender: string | null
  religion: string | null
  genotype: string | null
  blood_group: string | null
  allergies: string | null
  medical_history: string | null
  place_of_birth: string | null
  date_of_birth: string | null
  spouse: string | null
  spouse_phone: string | null
  number_of_kids: number | null
  ethnic_group: string | null
  alternate_phone: string | null
  alternate_email: string | null
  lga: string | null
  state: string | null
  country: string | null
}

// Single-row supplementary tables
export interface Employee360Address {
  id: string
  residential_address: string
  nearest_bus_stop: string | null
  nearest_landmark: string | null
  city: string | null
  state: string
  country: string
}

export interface Employee360BankDetails {
  id: string
  bank_name: string
  account_name: string
  account_number: string
  account_type: string
  bvn: string | null
  nin: string | null
  pfa: string | null
  rsa_pin: string | null
  tax_id: string | null
  nhf_id: string | null
  staff_signature_url: string | null
}

// Multi-row tables – people (next_of_kin / family / dependants share the same shape)
export interface Employee360Person {
  id: string
  title: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
  relationship: string
  address: string
  purpose?: string | null
}

export interface Employee360Experience {
  id: string
  company: string
  position: string
  address: string
  phone: string | null
  email: string | null
  reason_for_leaving: string | null
  start_date: string
  end_date: string | null
}

export interface Employee360Education {
  id: string
  school: string
  course: string
  degree: string
  grade: string | null
  start_date: string
  end_date: string | null
  document_url: string | null
}

export interface Employee360Training {
  id: string
  institution: string
  course: string
  license_name: string | null
  issuing_body: string | null
  start_date: string
  end_date: string | null
  document_url: string | null
}

export interface Employee360Response {
  employee: Employee360Employee
  biodata: Employee360Biodata
  // Single-row supplementary
  address: Employee360Address | null
  bankDetails: Employee360BankDetails | null
  // Multi-row tables
  nextOfKin: Employee360Person[]
  family: Employee360Person[]
  dependants: Employee360Person[]
  experience: Employee360Experience[]
  education: Employee360Education[]
  training: Employee360Training[]
  // Audit
  changeHistory: ChangeEvent[]
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: employeeId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()
    if (!profile?.organization_id)
      return NextResponse.json({ error: 'Organization not found' }, { status: 403 })

    const orgId = profile.organization_id as string

    // ── Parallel fetch of all tables ─────────────────────────────────────────
    const [
      empResult,
      biodataResult,
      addressResult,
      bankResult,
      nokResult,
      familyResult,
      dependantsResult,
      experienceResult,
      educationResult,
      trainingResult,
      historyResult,
    ] = await Promise.all([
      supabase
        .from('employees')
        .select(
          'id, organization_id, staff_id, email, phone, contract_type, start_date, end_date, employment_status, active, created_at, department_id, job_role_id, manager_id, report_location'
        )
        .eq('id', employeeId)
        .eq('organization_id', orgId)
        .single(),

      supabase
        .from('employee_biodata')
        .select(
          'title, firstname, lastname, othernames, mothers_maiden_name, marital_status, gender, religion, genotype, blood_group, allergies, medical_history, place_of_birth, date_of_birth, spouse, spouse_phone, number_of_kids, ethnic_group, alternate_phone, alternate_email, lga, state, country'
        )
        .eq('employee_id', employeeId)
        .eq('organization_id', orgId)
        .maybeSingle(),

      supabase
        .from('employee_address')
        .select('id, residential_address, nearest_bus_stop, nearest_landmark, city, state, country')
        .eq('employee_id', employeeId)
        .eq('organization_id', orgId)
        .maybeSingle(),

      supabase
        .from('employee_bank_details')
        .select('id, bank_name, account_name, account_number, account_type, bvn, nin, pfa, rsa_pin, tax_id, nhf_id, staff_signature_url')
        .eq('employee_id', employeeId)
        .eq('organization_id', orgId)
        .maybeSingle(),

      supabase
        .from('employee_next_of_kin')
        .select('id, title, first_name, last_name, phone, email, relationship, address, purpose, created_at')
        .eq('employee_id', employeeId)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true }),

      supabase
        .from('employee_family')
        .select('id, title, first_name, last_name, phone, email, relationship, address, created_at')
        .eq('employee_id', employeeId)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true }),

      supabase
        .from('employee_dependants')
        .select('id, title, first_name, last_name, phone, email, relationship, address, created_at')
        .eq('employee_id', employeeId)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true }),

      supabase
        .from('employee_experience')
        .select('id, company, position, address, phone, email, reason_for_leaving, start_date, end_date, created_at')
        .eq('employee_id', employeeId)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true }),

      supabase
        .from('employee_education')
        .select('id, school, course, degree, grade, start_date, end_date, document_url, created_at')
        .eq('employee_id', employeeId)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true }),

      supabase
        .from('employee_training')
        .select('id, institution, course, license_name, issuing_body, start_date, end_date, document_url, created_at')
        .eq('employee_id', employeeId)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true }),

      supabase
        .from('employee_change_events')
        .select('id, source_table, field, old_value, new_value, requested_by, status, reason, created_at')
        .eq('employee_id', employeeId)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(200),
    ])

    if (empResult.error || !empResult.data)
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    const emp = empResult.data as Record<string, unknown>

    // ── Enrich: department, job role, location, manager ───────────────────────
    const [deptResult, roleResult, locationResult, managerResult] = await Promise.all([
      emp.department_id
        ? supabase.from('departments').select('name, code').eq('id', emp.department_id as string).single()
        : Promise.resolve({ data: null, error: null }),
      emp.job_role_id
        ? supabase.from('job_roles').select('title, code').eq('id', emp.job_role_id as string).single()
        : Promise.resolve({ data: null, error: null }),
      emp.report_location
        ? supabase.from('organization_location').select('address').eq('id', emp.report_location as string).single()
        : Promise.resolve({ data: null, error: null }),
      emp.manager_id
        ? supabase
            .from('employee_biodata')
            .select('firstname, lastname')
            .eq('employee_id', emp.manager_id as string)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    const dept = deptResult.data as { name: string; code: string | null } | null
    const role = roleResult.data as { title: string; code: string | null } | null
    const location = locationResult.data as { address: string | null } | null
    const managerBio = managerResult.data as { firstname: string | null; lastname: string | null } | null

    const managerName = managerBio
      ? [managerBio.firstname, managerBio.lastname].filter(Boolean).join(' ') || null
      : null

    // ── Requester names for change history ────────────────────────────────────
    const historyRaw = (historyResult.data ?? []) as Array<Record<string, unknown>>
    const requesterIds = [...new Set(historyRaw.map((h) => h.requested_by as string))]
    const requesterEmailMap = new Map<string, string>()
    if (requesterIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', requesterIds)
      for (const p of profilesData ?? []) {
        const row = p as { id: string; email: string | null }
        requesterEmailMap.set(row.id, row.email ?? row.id.slice(0, 8))
      }
    }

    // ── Build response ────────────────────────────────────────────────────────

    const employee: Employee360Employee = {
      id: emp.id as string,
      organization_id: emp.organization_id as string,
      staff_id: emp.staff_id as string,
      email: emp.email as string,
      phone: (emp.phone ?? null) as string | null,
      contract_type: emp.contract_type as string,
      start_date: (emp.start_date ?? null) as string | null,
      end_date: (emp.end_date ?? null) as string | null,
      employment_status: emp.employment_status as string,
      active: emp.active as boolean,
      created_at: emp.created_at as string,
      department_id: emp.department_id as string,
      job_role_id: emp.job_role_id as string,
      manager_id: (emp.manager_id ?? null) as string | null,
      report_location: (emp.report_location ?? null) as string | null,
      department_name: dept?.name ?? null,
      department_code: dept?.code ?? null,
      job_role_title: role?.title ?? null,
      job_role_code: role?.code ?? null,
      manager_name: managerName,
      location_address: location?.address ?? null,
    }

    const rawBio = (biodataResult.data ?? {}) as Record<string, unknown>
    const biodata: Employee360Biodata = {
      title: (rawBio.title ?? null) as string | null,
      firstname: (rawBio.firstname ?? null) as string | null,
      lastname: (rawBio.lastname ?? null) as string | null,
      othernames: (rawBio.othernames ?? null) as string | null,
      mothers_maiden_name: (rawBio.mothers_maiden_name ?? null) as string | null,
      marital_status: (rawBio.marital_status ?? null) as string | null,
      gender: (rawBio.gender ?? null) as string | null,
      religion: (rawBio.religion ?? null) as string | null,
      genotype: (rawBio.genotype ?? null) as string | null,
      blood_group: (rawBio.blood_group ?? null) as string | null,
      allergies: (rawBio.allergies ?? null) as string | null,
      medical_history: (rawBio.medical_history ?? null) as string | null,
      place_of_birth: (rawBio.place_of_birth ?? null) as string | null,
      date_of_birth: (rawBio.date_of_birth ?? null) as string | null,
      spouse: (rawBio.spouse ?? null) as string | null,
      spouse_phone: (rawBio.spouse_phone ?? null) as string | null,
      number_of_kids: (rawBio.number_of_kids ?? null) as number | null,
      ethnic_group: (rawBio.ethnic_group ?? null) as string | null,
      alternate_phone: (rawBio.alternate_phone ?? null) as string | null,
      alternate_email: (rawBio.alternate_email ?? null) as string | null,
      lga: (rawBio.lga ?? null) as string | null,
      state: (rawBio.state ?? null) as string | null,
      country: (rawBio.country ?? null) as string | null,
    }

    const rawAddr = addressResult.data as Record<string, unknown> | null
    const address: Employee360Address | null = rawAddr
      ? {
          id: rawAddr.id as string,
          residential_address: rawAddr.residential_address as string,
          nearest_bus_stop: (rawAddr.nearest_bus_stop ?? null) as string | null,
          nearest_landmark: (rawAddr.nearest_landmark ?? null) as string | null,
          city: (rawAddr.city ?? null) as string | null,
          state: rawAddr.state as string,
          country: rawAddr.country as string,
        }
      : null

    const rawBank = bankResult.data as Record<string, unknown> | null
    const bankDetails: Employee360BankDetails | null = rawBank
      ? {
          id: rawBank.id as string,
          bank_name: rawBank.bank_name as string,
          account_name: rawBank.account_name as string,
          account_number: rawBank.account_number as string,
          account_type: rawBank.account_type as string,
          bvn: (rawBank.bvn ?? null) as string | null,
          nin: (rawBank.nin ?? null) as string | null,
          pfa: (rawBank.pfa ?? null) as string | null,
          rsa_pin: (rawBank.rsa_pin ?? null) as string | null,
          tax_id: (rawBank.tax_id ?? null) as string | null,
          nhf_id: (rawBank.nhf_id ?? null) as string | null,
          staff_signature_url: (rawBank.staff_signature_url ?? null) as string | null,
        }
      : null

    const mapPerson = (r: Record<string, unknown>): Employee360Person => ({
      id: r.id as string,
      title: r.title as string,
      first_name: r.first_name as string,
      last_name: r.last_name as string,
      phone: r.phone as string,
      email: (r.email ?? null) as string | null,
      relationship: r.relationship as string,
      address: r.address as string,
      purpose: (r.purpose ?? null) as string | null,
    })

    const response: Employee360Response = {
      employee,
      biodata,
      address,
      bankDetails,
      nextOfKin: ((nokResult.data ?? []) as Record<string, unknown>[]).map(mapPerson),
      family: ((familyResult.data ?? []) as Record<string, unknown>[]).map(mapPerson),
      dependants: ((dependantsResult.data ?? []) as Record<string, unknown>[]).map(mapPerson),
      experience: ((experienceResult.data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: r.id as string,
        company: r.company as string,
        position: r.position as string,
        address: r.address as string,
        phone: (r.phone ?? null) as string | null,
        email: (r.email ?? null) as string | null,
        reason_for_leaving: (r.reason_for_leaving ?? null) as string | null,
        start_date: r.start_date as string,
        end_date: (r.end_date ?? null) as string | null,
      })),
      education: ((educationResult.data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: r.id as string,
        school: r.school as string,
        course: r.course as string,
        degree: r.degree as string,
        grade: (r.grade ?? null) as string | null,
        start_date: r.start_date as string,
        end_date: (r.end_date ?? null) as string | null,
        document_url: (r.document_url ?? null) as string | null,
      })),
      training: ((trainingResult.data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: r.id as string,
        institution: r.institution as string,
        course: r.course as string,
        license_name: (r.license_name ?? null) as string | null,
        issuing_body: (r.issuing_body ?? null) as string | null,
        start_date: r.start_date as string,
        end_date: (r.end_date ?? null) as string | null,
        document_url: (r.document_url ?? null) as string | null,
      })),
      changeHistory: historyRaw.map((h) => ({
        id: h.id as string,
        source_table: h.source_table as 'employees' | 'employee_biodata',
        field: h.field as string,
        old_value: h.old_value,
        new_value: h.new_value,
        requested_by: h.requested_by as string,
        requester_name: requesterEmailMap.get(h.requested_by as string) ?? null,
        status: h.status as 'applied' | 'pending_approval' | 'rejected',
        reason: (h.reason ?? null) as string | null,
        created_at: h.created_at as string,
      })),
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[employee-360]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
