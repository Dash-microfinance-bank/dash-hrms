/** Stored in salary_components.formula and organization_payroll_components.formula */
export const DEDUCTION_FORMULA_PAYE_NIGERIA = 'PAYE(Nigeria)' as const

export function isPayeNigeriaDeductionFormula(
  formula: string | null | undefined
): boolean {
  return (formula ?? '').trim() === DEDUCTION_FORMULA_PAYE_NIGERIA
}
