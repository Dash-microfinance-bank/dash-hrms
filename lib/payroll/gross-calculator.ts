/**
 * Pure gross pay from base salary + taxable earning-structure allowances.
 *
 * Breakdown includes a synthetic BASIC line plus taxable allowance lines.
 * Rounding policy: each line amount is rounded to 2 dp, then
 * `gross = roundMoney(sum(breakdown[].amount))`.
 *
 * Unsupported in v1 (amount treated as 0, `console.warn` once per allowance id):
 * - `calculation_type === 'FORMULA'`
 * - `PERCENTAGE` when `calculation_base` is not `BASIC` or `NONE` (NONE treated as % of basic)
 */

export const BASIC_BREAKDOWN_TYPE = 'BASIC'
export const BASIC_BREAKDOWN_NAME = 'Basic salary'

export type AllowanceBreakdownItem = {
  name: string
  type: string
  amount: number
  salary_component_id?: string
}

export type GrossCalculatorResult = {
  gross: number
  allowanceBreakdown: AllowanceBreakdownItem[]
}

export type TaxableAllowanceLine = {
  salary_component_id: string
  name: string
  calculation_type: 'FIXED' | 'PERCENTAGE' | 'FORMULA' | string | null
  calculation_base: string | null
  value: number | null
  formula: string | null
  is_taxable?: boolean | null
}

const warnedUnsupported = new Set<string>()

function warnOnce(key: string, message: string) {
  if (warnedUnsupported.has(key)) return
  warnedUnsupported.add(key)
  console.warn(`[grossCalculator] ${message}`)
}

export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

export function buildBasicLine(baseSalary: number): AllowanceBreakdownItem {
  const base = Number.isFinite(baseSalary) ? baseSalary : 0
  return {
    name: BASIC_BREAKDOWN_NAME,
    type: BASIC_BREAKDOWN_TYPE,
    amount: roundMoney(base),
  }
}

/** Ensures exactly one BASIC line (first), synced to current base salary. */
export function normalizeBreakdownWithBase(
  baseSalary: number,
  breakdown: AllowanceBreakdownItem[]
): AllowanceBreakdownItem[] {
  const basic = buildBasicLine(baseSalary)
  const nonBasic = (breakdown ?? []).filter((line) => line.type !== BASIC_BREAKDOWN_TYPE)
  return [basic, ...nonBasic.map((line) => ({ ...line }))]
}

export function grossFromBreakdown(breakdown: AllowanceBreakdownItem[]): number {
  const sum = (breakdown ?? []).reduce(
    (s, b) => s + (Number.isFinite(b.amount) ? b.amount : 0),
    0
  )
  return roundMoney(sum)
}

/** @deprecated Use normalizeBreakdownWithBase + grossFromBreakdown */
export function grossFromBaseAndBreakdown(
  baseSalary: number,
  breakdown: AllowanceBreakdownItem[]
): number {
  return grossFromBreakdown(normalizeBreakdownWithBase(baseSalary, breakdown))
}

function computeLineAmount(
  baseSalary: number,
  line: TaxableAllowanceLine
): { amount: number; typeLabel: string } {
  const typeLabel = line.calculation_type ?? 'UNKNOWN'
  const pctBase = line.calculation_base === 'BASIC' || line.calculation_base === 'NONE' || line.calculation_base == null

  if (line.calculation_type === 'FIXED') {
    return { amount: roundMoney(Number(line.value ?? 0)), typeLabel }
  }

  if (line.calculation_type === 'PERCENTAGE') {
    if (pctBase) {
      const pct = Number(line.value ?? 0)
      return { amount: roundMoney(baseSalary * (pct / 100)), typeLabel }
    }
    warnOnce(
      `pct-${line.salary_component_id}-${line.calculation_base}`,
      `Unsupported PERCENTAGE base "${line.calculation_base}" for ${line.name} (${line.salary_component_id}); using 0.`
    )
    return { amount: 0, typeLabel }
  }

  if (line.calculation_type === 'FORMULA') {
    warnOnce(`form-${line.salary_component_id}`, `FORMULA not evaluated for ${line.name} (${line.salary_component_id}); using 0.`)
    return { amount: 0, typeLabel }
  }

  warnOnce(`unk-${line.salary_component_id}`, `Unknown calculation_type for ${line.name}; using 0.`)
  return { amount: 0, typeLabel }
}

export function grossCalculator(input: {
  baseSalary: number
  taxableAllowances: TaxableAllowanceLine[]
}): GrossCalculatorResult {
  const base = Number.isFinite(input.baseSalary) ? input.baseSalary : 0
  const lines = (input.taxableAllowances ?? []).filter((l) => l.is_taxable === true)

  const allowanceLines: AllowanceBreakdownItem[] = lines.map((line) => {
    const { amount, typeLabel } = computeLineAmount(base, line)
    return {
      name: line.name?.trim() || 'Allowance',
      type: typeLabel,
      amount,
      salary_component_id: line.salary_component_id,
    }
  })

  const allowanceBreakdown = normalizeBreakdownWithBase(base, allowanceLines)
  const gross = grossFromBreakdown(allowanceBreakdown)

  return { gross, allowanceBreakdown }
}
