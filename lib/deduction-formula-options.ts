/** Stored in salary_components.formula and organization_payroll_components.formula */
export const DEDUCTION_FORMULA_PAYE_NIGERIA = 'PAYE(Nigeria)' as const

export function isPayeNigeriaDeductionFormula(
  formula: string | null | undefined
): boolean {
  return (formula ?? '').trim() === DEDUCTION_FORMULA_PAYE_NIGERIA
}

export const PAYE_NIGERIA_FORMULA_DEDUCTION_DUPLICATE_ERROR =
  'PAYE(Nigeria) is already configured for this organization.' as const

export type PayeNigeriaFormulaDeductionRowShape = {
  calculation_type: unknown
  formula: string | null
  payroll_formula?: string | null
}

/** True when this deduction row is a stored PAYE(Nigeria) formula component. */
export function isPayeNigeriaFormulaDeductionRow(
  row: PayeNigeriaFormulaDeductionRowShape
): boolean {
  return (
    row.calculation_type === 'FORMULA' &&
    isPayeNigeriaDeductionFormula(row.formula ?? row.payroll_formula)
  )
}
