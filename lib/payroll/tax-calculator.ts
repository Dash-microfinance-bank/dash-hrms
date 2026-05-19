/**
 * 2026 Nigeria PAYE tax calculator and payroll deductions engine.
 *
 * Formula: taxableIncome = gross - sum(PRE_TAX_DEDUCTIONS)
 *          PAYE = bracket(annualised(taxableIncome)) / 12
 *          net  = gross - preTaxTotal - tax - postTaxTotal
 *
 * Source: Nigeria Tax Act 2025 (effective 1 January 2026).
 */

import { roundMoney } from '@/lib/payroll/gross-calculator'
import { isPayeNigeriaDeductionFormula } from '@/lib/deduction-formula-options'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PayrollDeductionBreakdownItem = {
  name: string
  phase: 'PRE_TAX_DEDUCTION' | 'TAX' | 'POST_TAX_DEDUCTION'
  amount: number
  salary_component_id?: string
  code?: string | null
}

export type PayrollDeductionsResult = {
  breakdown: PayrollDeductionBreakdownItem[]
  preTaxTotal: number
  taxableIncome: number
  tax: number
  postTaxTotal: number
  totalDeductions: number
  net: number
}

/** Deduction component definition passed in from the data layer. */
export type ConfiguredDeductionLine = {
  salary_component_id: string
  name: string
  code: string | null
  calculation_type: string | null
  calculation_base: string | null
  /** execution_phase stored on salary_components: PRE_TAX_DEDUCTION | TAX | POST_TAX_DEDUCTION */
  execution_phase: string | null
  value: number | null
  /** formula on salary_components (e.g. "PAYE(Nigeria)") */
  formula: string | null
}

// ---------------------------------------------------------------------------
// 2026 Nigeria PAYE brackets (annual thresholds, progressive bands)
// ---------------------------------------------------------------------------

/**
 * Annual PAYE brackets under the Nigeria Tax Act 2025 (effective 1 Jan 2026).
 * Each entry covers a contiguous band of annual taxable income:
 *   band 1 : first ₦300,000   @ 7%
 *   band 2 : next  ₦300,000   @ 11%
 *   band 3 : next  ₦500,000   @ 15%
 *   band 4 : next  ₦500,000   @ 19%
 *   band 5 : next  ₦1,600,000 @ 21%
 *   band 6 : above ₦3,200,000 @ 24%
 */
// const PAYE_BRACKETS_2026: { bandSize: number; rate: number }[] = [
//   { bandSize: 300_000, rate: 0.07 },
//   { bandSize: 300_000, rate: 0.11 },
//   { bandSize: 500_000, rate: 0.15 },
//   { bandSize: 500_000, rate: 0.19 },
//   { bandSize: 1_600_000, rate: 0.21 },
//   { bandSize: Infinity, rate: 0.24 },
// ]

const PAYE_BRACKETS_2026: { bandSize: number; rate: number }[] = [
  { bandSize: 800_000, rate: 0 },
  { bandSize: 2_200_000, rate: 0.15 },
  { bandSize: 9_000_000, rate: 0.18 },
  { bandSize: 13_000_000, rate: 0.21 },
  { bandSize: 25_000_000, rate: 0.23 },
  { bandSize: Infinity, rate: 0.25 },
]

/**
 * Compute annual PAYE tax for a given annual taxable income.
 * Returns the annual tax amount (use / 12 for monthly deduction).
 */
export function computeNigeriaPaye2026Annual(annualTaxableIncome: number): number {
  if (!Number.isFinite(annualTaxableIncome) || annualTaxableIncome <= 0) return 0
  let remaining = annualTaxableIncome
  let annualTax = 0
  for (const { bandSize, rate } of PAYE_BRACKETS_2026) {
    if (remaining <= 0) break
    const taxable = bandSize === Infinity ? remaining : Math.min(remaining, bandSize)
    annualTax += taxable * rate
    remaining -= taxable
  }
  return roundMoney(annualTax)
}

/**
 * Compute monthly PAYE tax by annualising the monthly taxable income,
 * applying the 2026 brackets, then dividing by 12.
 */
export function computeNigeriaPaye2026Monthly(monthlyTaxableIncome: number): number {
  if (!Number.isFinite(monthlyTaxableIncome) || monthlyTaxableIncome <= 0) return 0
  const annualTax = computeNigeriaPaye2026Annual(monthlyTaxableIncome * 12)
  return roundMoney(annualTax / 12)
}

// ---------------------------------------------------------------------------
// Per-line deduction amount
// ---------------------------------------------------------------------------

function computeDeductionLineAmount(
  gross: number,
  baseSalary: number,
  taxableIncome: number,
  line: ConfiguredDeductionLine
): number {
  if (line.calculation_type === 'FIXED') {
    return roundMoney(Number(line.value ?? 0))
  }
  if (line.calculation_type === 'PERCENTAGE') {
    const pct = Number(line.value ?? 0)
    if (line.calculation_base === 'GROSS') return roundMoney(gross * (pct / 100))
    if (line.calculation_base === 'TAXABLE') return roundMoney(taxableIncome * (pct / 100))
    // BASIC, NONE, or null → use base salary
    return roundMoney(baseSalary * (pct / 100))
  }
  // FORMULA deductions (PAYE) are handled separately; other formulas return 0.
  return 0
}

// ---------------------------------------------------------------------------
// Main deductions engine
// ---------------------------------------------------------------------------

/**
 * Compute a full payroll deductions breakdown from gross pay and the org's
 * configured deduction components.
 *
 * Processing order:
 *  1. PRE_TAX_DEDUCTION  – fixed / % of basic or gross; reduce taxable income
 *  2. Taxable income     = max(0, gross − preTaxTotal)
 *  3. TAX phase          – PAYE(Nigeria) formula uses brackets; other TAX
 *                          lines use their own formula (0 if unsupported)
 *  4. POST_TAX_DEDUCTION – fixed / % of basic, gross, or taxable income
 *  5. Net                = max(0, gross − totalDeductions)
 */
export function computePayrollDeductions(input: {
  gross: number
  baseSalary: number
  configuredDeductions: ConfiguredDeductionLine[]
}): PayrollDeductionsResult {
  const gross = Number.isFinite(input.gross) ? input.gross : 0
  const baseSalary = Number.isFinite(input.baseSalary) ? input.baseSalary : 0
  const breakdown: PayrollDeductionBreakdownItem[] = []

  // --- 1. PRE_TAX deductions ---
  let preTaxTotal = 0
  for (const line of input.configuredDeductions) {
    if (line.execution_phase !== 'PRE_TAX_DEDUCTION') continue
    const amount = computeDeductionLineAmount(gross, baseSalary, 0, line)
    preTaxTotal += amount
    breakdown.push({ name: line.name, phase: 'PRE_TAX_DEDUCTION', amount, salary_component_id: line.salary_component_id, code: line.code })
  }
  preTaxTotal = roundMoney(preTaxTotal)

  // --- 2. Taxable income ---
  const taxableIncome = roundMoney(Math.max(0, gross - preTaxTotal))

  // --- 3. TAX phase ---
  let tax = 0
  for (const line of input.configuredDeductions) {
    if (line.execution_phase !== 'TAX') continue
    let amount: number
    if (isPayeNigeriaDeductionFormula(line.formula)) {
      amount = computeNigeriaPaye2026Monthly(taxableIncome)
    } else {
      amount = computeDeductionLineAmount(gross, baseSalary, taxableIncome, line)
    }
    tax += amount
    breakdown.push({ name: line.name, phase: 'TAX', amount, salary_component_id: line.salary_component_id, code: line.code })
  }
  tax = roundMoney(tax)

  // --- 4. POST_TAX deductions ---
  let postTaxTotal = 0
  for (const line of input.configuredDeductions) {
    if (line.execution_phase !== 'POST_TAX_DEDUCTION') continue
    const amount = computeDeductionLineAmount(gross, baseSalary, taxableIncome, line)
    postTaxTotal += amount
    breakdown.push({ name: line.name, phase: 'POST_TAX_DEDUCTION', amount, salary_component_id: line.salary_component_id, code: line.code })
  }
  postTaxTotal = roundMoney(postTaxTotal)

  const totalDeductions = roundMoney(preTaxTotal + tax + postTaxTotal)
  const net = roundMoney(Math.max(0, gross - totalDeductions))

  return { breakdown, preTaxTotal, taxableIncome, tax, postTaxTotal, totalDeductions, net }
}
