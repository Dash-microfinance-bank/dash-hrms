'use server'

// Each public function is wrapped with React.cache for within-request memoization.
// unstable_cache is intentionally NOT used here: Supabase's createClient() reads
// cookies() (request-scoped dynamic data) which Next.js prohibits inside
// unstable_cache's persistent cross-request cache context.
// React.cache gives us deduplication within a single render tree, which is the
// correct semantic for session-authenticated, org-scoped queries.
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type {
  AnalyticsResult,
  AgeGroupLabel,
  AgeGroupStat,
  ContractTypeStat,
  DepartmentStat,
  EmployeeAnalyticsData,
  EmployeeKpiStats,
  EmploymentStatusStat,
  EthnicGroupStat,
  GenderStat,
  MaritalStatusStat,
  OfficeLocationStat,
  ReligionStat,
  StateOfOriginStat,
} from '@/types/analytics'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok<T>(data: T): AnalyticsResult<T> {
  return { data, error: null }
}

function err<T>(message: string): AnalyticsResult<T> {
  return { data: null, error: message }
}

// ─── KPI stats ────────────────────────────────────────────────────────────────

export const getKpiStats = cache(async (
  organizationId: string
): Promise<AnalyticsResult<EmployeeKpiStats>> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('employee_kpi_stats')
    .select('active_employees, total_employees, avg_age, male_count, female_count')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) {
    console.error('[analytics] getKpiStats error:', error.message)
    return err(error.message)
  }

  if (!data) {
    return ok<EmployeeKpiStats>({
      totalEmployees: 0,
      activeEmployees: 0,
      avgAge: null,
      maleCount: 0,
      femaleCount: 0,
    })
  }

  return ok<EmployeeKpiStats>({
    totalEmployees: Number(data.total_employees ?? 0),
    activeEmployees: Number(data.active_employees ?? 0),
    avgAge: data.avg_age != null ? Number(data.avg_age) : null,
    maleCount: Number(data.male_count ?? 0),
    femaleCount: Number(data.female_count ?? 0),
  })
})

// ─── Gender ───────────────────────────────────────────────────────────────────

export const getGenderStats = cache(async (
  organizationId: string
): Promise<AnalyticsResult<GenderStat[]>> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('employee_gender_stats')
    .select('gender, employee_count')
    .eq('organization_id', organizationId)
    .order('employee_count', { ascending: false })

  if (error) {
    console.error('[analytics] getGenderStats error:', error.message)
    return err(error.message)
  }

  return ok<GenderStat[]>(
    (data ?? []).map((row) => ({
      gender: String(row.gender ?? 'Unknown'),
      employeeCount: Number(row.employee_count ?? 0),
    }))
  )
})

// ─── Religion ─────────────────────────────────────────────────────────────────

export const getReligionStats = cache(async (
  organizationId: string
): Promise<AnalyticsResult<ReligionStat[]>> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('employee_religion_stats')
    .select('religion, employee_count')
    .eq('organization_id', organizationId)
    .order('employee_count', { ascending: false })

  if (error) {
    console.error('[analytics] getReligionStats error:', error.message)
    return err(error.message)
  }

  return ok<ReligionStat[]>(
    (data ?? []).map((row) => ({
      religion: String(row.religion ?? 'Unknown'),
      employeeCount: Number(row.employee_count ?? 0),
    }))
  )
})

// ─── Age groups ───────────────────────────────────────────────────────────────

const AGE_GROUP_ORDER: AgeGroupLabel[] = ['18-24', '25-34', '35-44', '45-54', '55+', 'Unknown']

export const getAgeGroupStats = cache(async (
  organizationId: string
): Promise<AnalyticsResult<AgeGroupStat[]>> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('employee_age_group_stats')
    .select('age_group, employee_count')
    .eq('organization_id', organizationId)

  if (error) {
    console.error('[analytics] getAgeGroupStats error:', error.message)
    return err(error.message)
  }

  const rows = (data ?? []).map((row) => ({
    ageGroup: String(row.age_group ?? 'Unknown') as AgeGroupLabel,
    employeeCount: Number(row.employee_count ?? 0),
  }))

  rows.sort(
    (a, b) =>
      AGE_GROUP_ORDER.indexOf(a.ageGroup) - AGE_GROUP_ORDER.indexOf(b.ageGroup)
  )

  return ok<AgeGroupStat[]>(rows)
})

// ─── Marital status ───────────────────────────────────────────────────────────

export const getMaritalStatusStats = cache(async (
  organizationId: string
): Promise<AnalyticsResult<MaritalStatusStat[]>> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('employee_marital_status_stats')
    .select('marital_status, employee_count')
    .eq('organization_id', organizationId)
    .order('employee_count', { ascending: false })

  if (error) {
    console.error('[analytics] getMaritalStatusStats error:', error.message)
    return err(error.message)
  }

  return ok<MaritalStatusStat[]>(
    (data ?? []).map((row) => ({
      maritalStatus: String(row.marital_status ?? 'Unknown'),
      employeeCount: Number(row.employee_count ?? 0),
    }))
  )
})

// ─── Departments ──────────────────────────────────────────────────────────────

export const getDepartmentStats = cache(async (
  organizationId: string
): Promise<AnalyticsResult<DepartmentStat[]>> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('employee_department_stats')
    .select('department_name, employee_count')
    .eq('organization_id', organizationId)
    .order('employee_count', { ascending: false })

  if (error) {
    console.error('[analytics] getDepartmentStats error:', error.message)
    return err(error.message)
  }

  return ok<DepartmentStat[]>(
    (data ?? []).map((row) => ({
      departmentName: String(row.department_name ?? 'Unknown'),
      employeeCount: Number(row.employee_count ?? 0),
    }))
  )
})

// ─── Contract type ────────────────────────────────────────────────────────────

export const getContractTypeStats = cache(async (
  organizationId: string
): Promise<AnalyticsResult<ContractTypeStat[]>> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('employee_contract_type_stats')
    .select('contract_type, employee_count')
    .eq('organization_id', organizationId)
    .order('employee_count', { ascending: false })

  if (error) {
    console.error('[analytics] getContractTypeStats error:', error.message)
    return err(error.message)
  }

  return ok<ContractTypeStat[]>(
    (data ?? []).map((row) => ({
      contractType: String(row.contract_type ?? 'Unknown'),
      employeeCount: Number(row.employee_count ?? 0),
    }))
  )
})

// ─── Employment status ────────────────────────────────────────────────────────

export const getEmploymentStatusStats = cache(async (
  organizationId: string
): Promise<AnalyticsResult<EmploymentStatusStat[]>> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('employee_employment_status_stats')
    .select('employment_status, employee_count')
    .eq('organization_id', organizationId)
    .order('employee_count', { ascending: false })

  if (error) {
    console.error('[analytics] getEmploymentStatusStats error:', error.message)
    return err(error.message)
  }

  return ok<EmploymentStatusStat[]>(
    (data ?? []).map((row) => ({
      employmentStatus: String(row.employment_status ?? 'Unknown'),
      employeeCount: Number(row.employee_count ?? 0),
    }))
  )
})

// ─── State of origin ──────────────────────────────────────────────────────────

export const getStateOfOriginStats = cache(async (
  organizationId: string
): Promise<AnalyticsResult<StateOfOriginStat[]>> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('employee_state_of_origin_stats')
    .select('state_of_origin, employee_count')
    .eq('organization_id', organizationId)
    .order('employee_count', { ascending: false })

  if (error) {
    console.error('[analytics] getStateOfOriginStats error:', error.message)
    return err(error.message)
  }

  return ok<StateOfOriginStat[]>(
    (data ?? []).map((row) => ({
      stateOfOrigin: String(row.state_of_origin ?? 'Unknown'),
      employeeCount: Number(row.employee_count ?? 0),
    }))
  )
})

// ─── Ethnic group ─────────────────────────────────────────────────────────────

export const getEthnicGroupStats = cache(async (
  organizationId: string
): Promise<AnalyticsResult<EthnicGroupStat[]>> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('employee_ethnic_group_stats')
    .select('ethnic_group, employee_count')
    .eq('organization_id', organizationId)
    .order('employee_count', { ascending: false })

  if (error) {
    console.error('[analytics] getEthnicGroupStats error:', error.message)
    return err(error.message)
  }

  return ok<EthnicGroupStat[]>(
    (data ?? []).map((row) => ({
      ethnicGroup: String(row.ethnic_group ?? 'Unknown'),
      employeeCount: Number(row.employee_count ?? 0),
    }))
  )
})

// ─── Office location ──────────────────────────────────────────────────────────

export const getOfficeLocationStats = cache(async (
  organizationId: string
): Promise<AnalyticsResult<OfficeLocationStat[]>> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('employee_office_location_stats')
    .select('office_location, employee_count')
    .eq('organization_id', organizationId)
    .order('employee_count', { ascending: false })

  if (error) {
    console.error('[analytics] getOfficeLocationStats error:', error.message)
    return err(error.message)
  }

  return ok<OfficeLocationStat[]>(
    (data ?? []).map((row) => ({
      officeLocation: String(row.office_location ?? 'Unknown'),
      employeeCount: Number(row.employee_count ?? 0),
    }))
  )
})

// ─── Aggregate fetcher ────────────────────────────────────────────────────────
// Fetches all 11 metrics in parallel. Each failure is isolated so the page
// can render partial results rather than failing entirely.

export async function getAllAnalyticsData(
  organizationId: string
): Promise<EmployeeAnalyticsData> {
  const [
    kpiResult,
    genderResult,
    religionResult,
    ageGroupResult,
    maritalStatusResult,
    departmentResult,
    contractTypeResult,
    employmentStatusResult,
    stateOfOriginResult,
    ethnicGroupResult,
    officeLocationResult,
  ] = await Promise.all([
    getKpiStats(organizationId),
    getGenderStats(organizationId),
    getReligionStats(organizationId),
    getAgeGroupStats(organizationId),
    getMaritalStatusStats(organizationId),
    getDepartmentStats(organizationId),
    getContractTypeStats(organizationId),
    getEmploymentStatusStats(organizationId),
    getStateOfOriginStats(organizationId),
    getEthnicGroupStats(organizationId),
    getOfficeLocationStats(organizationId),
  ])

  return {
    kpi: kpiResult.data,
    gender: genderResult.data ?? [],
    religion: religionResult.data ?? [],
    ageGroups: ageGroupResult.data ?? [],
    maritalStatus: maritalStatusResult.data ?? [],
    departments: departmentResult.data ?? [],
    contractType: contractTypeResult.data ?? [],
    employmentStatus: employmentStatusResult.data ?? [],
    stateOfOrigin: stateOfOriginResult.data ?? [],
    ethnicGroup: ethnicGroupResult.data ?? [],
    officeLocation: officeLocationResult.data ?? [],
  }
}
