// ─── Shared primitives ────────────────────────────────────────────────────────

/** A single aggregated row: a label and its headcount. */
export interface StatRow {
  label: string
  employeeCount: number
}

// ─── KPI summary ─────────────────────────────────────────────────────────────

export interface EmployeeKpiStats {
  /** Total headcount (active + inactive). */
  totalEmployees: number
  /** Headcount of currently active employees only. */
  activeEmployees: number
  /** Average age across active employees with a recorded DOB; null when no DOB data exists. */
  avgAge: number | null
  /** Count of active employees with gender = 'male'. */
  maleCount: number
  /** Count of active employees with gender = 'female'. */
  femaleCount: number
}

// ─── Distribution stats (one per metric) ─────────────────────────────────────

export interface GenderStat {
  gender: string
  employeeCount: number
}

export interface ReligionStat {
  religion: string
  employeeCount: number
}

/** Age-group bucket labels returned by the view. */
export type AgeGroupLabel = '18-24' | '25-34' | '35-44' | '45-54' | '55+' | 'Unknown'

export interface AgeGroupStat {
  ageGroup: AgeGroupLabel
  employeeCount: number
}

export interface MaritalStatusStat {
  maritalStatus: string
  employeeCount: number
}

export interface DepartmentStat {
  departmentName: string
  employeeCount: number
}

export interface ContractTypeStat {
  contractType: string
  employeeCount: number
}

export interface EmploymentStatusStat {
  employmentStatus: string
  employeeCount: number
}

export interface StateOfOriginStat {
  stateOfOrigin: string
  employeeCount: number
}

export interface EthnicGroupStat {
  ethnicGroup: string
  employeeCount: number
}

export interface OfficeLocationStat {
  officeLocation: string
  employeeCount: number
}

// ─── Aggregate payload (all metrics for one org) ──────────────────────────────
// The analytics page receives this object after parallel server-side fetching.

export interface EmployeeAnalyticsData {
  kpi: EmployeeKpiStats | null
  gender: GenderStat[]
  religion: ReligionStat[]
  ageGroups: AgeGroupStat[]
  maritalStatus: MaritalStatusStat[]
  departments: DepartmentStat[]
  contractType: ContractTypeStat[]
  employmentStatus: EmploymentStatusStat[]
  stateOfOrigin: StateOfOriginStat[]
  ethnicGroup: EthnicGroupStat[]
  officeLocation: OfficeLocationStat[]
}

// ─── Result envelope ──────────────────────────────────────────────────────────
// Used by each fetch function so callers can handle per-metric failures
// without breaking the rest of the dashboard.

export type AnalyticsResult<T> =
  | { data: T; error: null }
  | { data: null; error: string }

// ─── Future extension points (not yet implemented) ────────────────────────────
// Adding new metrics follows the same pattern:
//   1. Add a view returning (organization_id, dimension, employee_count)
//   2. Add a typed interface here
//   3. Add a fetch function in lib/api/analytics.ts
//   4. Add the field to EmployeeAnalyticsData
//   5. Render a chart in the analytics page
//
// Planned additions:
//   - WorkforceTrendPoint  (month, headcount, joiners, leavers)
//   - AttritionStat        (period, attrition_rate)
//   - DiversityIndexStat   (dimension, index_value)
//   - WorkforcePyramidRow  (age_group, gender, employee_count)
