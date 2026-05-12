'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  DEDUCTION_FORMULA_PAYE_NIGERIA,
  isPayeNigeriaDeductionFormula,
  PAYE_NIGERIA_FORMULA_DEDUCTION_DUPLICATE_ERROR,
} from '@/lib/deduction-formula-options'

const ADMIN_ROLES = ['super_admin', 'hr', 'finance'] as const
const DEDUCTIONS_PATH = '/dashboard/admin/payroll/deductions'

export type DeductionActionResult = { success: true } | { success: false; error: string }

async function getAdminContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' } as const

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) return { error: 'Organization not found' } as const

  const orgId = profile.organization_id
  const { data: rolesData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)

  const roles = (rolesData ?? []).map((r) => r.role as string)
  const hasAdminRole = roles.some((r) => ADMIN_ROLES.includes(r as (typeof ADMIN_ROLES)[number]))
  if (!hasAdminRole) {
    return { error: 'You do not have permission to manage deductions' } as const
  }

  return { supabase, orgId } as { supabase: typeof supabase; orgId: string }
}

type CalculationType = 'FIXED' | 'PERCENTAGE' | 'FORMULA'
type CalculationBase = 'NONE' | 'BASIC' | 'GROSS' | 'TAXABLE'

export type CreateDeductionInput = {
  name: string
  calculation_type: CalculationType
  calculation_base: CalculationBase
  reduces_taxable_income: boolean
  value: number | null
  formula: string | null
}

function persistedBaseAndReducesTax(
  input: CreateDeductionInput
): { calculation_base: CalculationBase; reduces_taxable_income: boolean } {
  if (input.calculation_type === 'FORMULA') {
    return { calculation_base: 'TAXABLE', reduces_taxable_income: false }
  }
  if (input.calculation_type === 'PERCENTAGE') {
    return {
      calculation_base: input.calculation_base,
      reduces_taxable_income: input.reduces_taxable_income,
    }
  }
  return {
    calculation_base: 'NONE',
    reduces_taxable_income: input.reduces_taxable_income,
  }
}

type ExecutionPhase = 'TAX' | 'PRE_TAX_DEDUCTION' | 'POST_TAX_DEDUCTION'

/** PAYE(Nigeria) formula stays in TAX phase; otherwise pre-tax vs post-tax follows the checkbox. */
function executionPhaseForDeduction(
  isPayeNigeriaFormula: boolean,
  reducesTaxableIncome: boolean
): ExecutionPhase {
  if (isPayeNigeriaFormula) return 'TAX'
  if (reducesTaxableIncome) return 'PRE_TAX_DEDUCTION'
  return 'POST_TAX_DEDUCTION'
}

export type UpdateDeductionInput = CreateDeductionInput

type AssertDeductionResult = { ok: true } | { error: string }

async function assertDeductionRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  id: string
): Promise<AssertDeductionResult> {
  const { data, error } = await supabase
    .from('salary_components')
    .select('id, organization_id, type')
    .eq('id', id)
    .single()
  if (error || !data) return { error: 'Deduction not found' }
  if (data.organization_id !== orgId || data.type !== 'DEDUCTION') {
    return { error: 'Cannot modify this deduction' }
  }
  return { ok: true }
}

function validateDeductionInput(input: CreateDeductionInput): string | null {
  const name = input.name.trim()
  if (!name) return 'Name is required'
  if (input.calculation_type === 'PERCENTAGE' && !['BASIC', 'GROSS'].includes(input.calculation_base)) {
    return 'Based on must be base salary or gross salary for percentage deductions'
  }
  if (input.calculation_type === 'FORMULA') {
    if (!isPayeNigeriaDeductionFormula(input.formula)) {
      return 'Formula is required'
    }
    return null
  }
  if (input.calculation_type === 'FIXED' || input.calculation_type === 'PERCENTAGE') {
    if (input.value == null || !Number.isFinite(input.value)) {
      return 'Value is required for fixed and percentage deductions'
    }
  }
  return null
}

export async function createDeduction(input: CreateDeductionInput): Promise<DeductionActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const err = validateDeductionInput(input)
  if (err) return { success: false, error: err }

  const { supabase, orgId } = ctx

  if (input.calculation_type === 'FORMULA') {
    const { data: existingPaye } = await supabase
      .from('salary_components')
      .select('id')
      .eq('organization_id', orgId)
      .eq('type', 'DEDUCTION')
      .eq('calculation_type', 'FORMULA')
      .eq('formula', DEDUCTION_FORMULA_PAYE_NIGERIA)
      .limit(1)
      .maybeSingle()

    if (existingPaye) {
      return { success: false, error: PAYE_NIGERIA_FORMULA_DEDUCTION_DUPLICATE_ERROR }
    }
  }

  const name = input.name.trim()
  const { calculation_base: calculationBase, reduces_taxable_income: reducesTaxable } =
    persistedBaseAndReducesTax(input)
  const formulaText =
    input.calculation_type === 'FORMULA' ? DEDUCTION_FORMULA_PAYE_NIGERIA : null
  const isPayeNigeria = input.calculation_type === 'FORMULA'
  const executionPhase = executionPhaseForDeduction(isPayeNigeria, reducesTaxable)

  const { data: inserted, error: insertErr } = await supabase
    .from('salary_components')
    .insert({
      organization_id: orgId,
      name,
      code: isPayeNigeria ? 'PAYE' : null,
      type: 'DEDUCTION',
      calculation_type: input.calculation_type,
      calculation_base: calculationBase,
      is_taxable: false,
      reduces_taxable_income: reducesTaxable,
      formula: formulaText,
      execution_phase: executionPhase,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    return { success: false, error: insertErr?.message ?? 'Failed to create deduction' }
  }

  const componentId = inserted.id
  const opcValue =
    input.calculation_type === 'FORMULA' ? null : input.value
  const opcFormula =
    input.calculation_type === 'FORMULA' ? formulaText : null

  const { error: opcErr } = await supabase.from('organization_payroll_components').insert({
    organization_id: orgId,
    component_id: componentId,
    value: opcValue,
    formula: opcFormula,
  })

  if (opcErr) {
    await supabase.from('salary_components').delete().eq('id', componentId).eq('organization_id', orgId)
    return { success: false, error: opcErr.message }
  }

  revalidatePath(DEDUCTIONS_PATH)
  return { success: true }
}

export async function updateDeduction(
  id: string,
  input: UpdateDeductionInput
): Promise<DeductionActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const err = validateDeductionInput(input)
  if (err) return { success: false, error: err }

  const { supabase, orgId } = ctx
  const check = await assertDeductionRow(supabase, orgId, id)
  if ('error' in check) return { success: false, error: check.error }

  if (input.calculation_type === 'FORMULA') {
    const { data: otherPaye } = await supabase
      .from('salary_components')
      .select('id')
      .eq('organization_id', orgId)
      .eq('type', 'DEDUCTION')
      .eq('calculation_type', 'FORMULA')
      .eq('formula', DEDUCTION_FORMULA_PAYE_NIGERIA)
      .neq('id', id)
      .limit(1)
      .maybeSingle()

    if (otherPaye) {
      return { success: false, error: PAYE_NIGERIA_FORMULA_DEDUCTION_DUPLICATE_ERROR }
    }
  }

  const name = input.name.trim()
  const { calculation_base: calculationBase, reduces_taxable_income: reducesTaxable } =
    persistedBaseAndReducesTax(input)
  const formulaText =
    input.calculation_type === 'FORMULA' ? DEDUCTION_FORMULA_PAYE_NIGERIA : null
  const isPayeNigeria = input.calculation_type === 'FORMULA'
  const executionPhase = executionPhaseForDeduction(isPayeNigeria, reducesTaxable)

  const { error: scErr } = await supabase
    .from('salary_components')
    .update({
      name,
      calculation_type: input.calculation_type,
      calculation_base: calculationBase,
      reduces_taxable_income: reducesTaxable,
      formula: formulaText,
      code: isPayeNigeria ? 'PAYE' : null,
      execution_phase: executionPhase,
    })
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('type', 'DEDUCTION')

  if (scErr) return { success: false, error: scErr.message ?? 'Update failed' }

  const opcValue =
    input.calculation_type === 'FORMULA' ? null : input.value
  const opcFormula =
    input.calculation_type === 'FORMULA' ? formulaText : null

  const { data: existingOpc } = await supabase
    .from('organization_payroll_components')
    .select('id')
    .eq('organization_id', orgId)
    .eq('component_id', id)
    .maybeSingle()

  if (existingOpc) {
    const { error: opcUpd } = await supabase
      .from('organization_payroll_components')
      .update({ value: opcValue, formula: opcFormula })
      .eq('id', existingOpc.id)
    if (opcUpd) return { success: false, error: opcUpd.message ?? 'Payroll value update failed' }
  } else {
    const { error: opcIns } = await supabase.from('organization_payroll_components').insert({
      organization_id: orgId,
      component_id: id,
      value: opcValue,
      formula: opcFormula,
    })
    if (opcIns) return { success: false, error: opcIns.message ?? 'Payroll value insert failed' }
  }

  revalidatePath(DEDUCTIONS_PATH)
  return { success: true }
}

export async function deleteDeduction(id: string): Promise<DeductionActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }
  const { supabase, orgId } = ctx

  const check = await assertDeductionRow(supabase, orgId, id)
  if ('error' in check) return { success: false, error: check.error }

  await supabase
    .from('organization_payroll_components')
    .delete()
    .eq('organization_id', orgId)
    .eq('component_id', id)

  const { error } = await supabase
    .from('salary_components')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('type', 'DEDUCTION')

  if (error) return { success: false, error: error.message ?? 'Delete failed' }
  revalidatePath(DEDUCTIONS_PATH)
  return { success: true }
}

export async function disableDeduction(id: string): Promise<DeductionActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }
  const { supabase, orgId } = ctx

  const check = await assertDeductionRow(supabase, orgId, id)
  if ('error' in check) return { success: false, error: check.error }

  const { error } = await supabase
    .from('salary_components')
    .update({ is_active: false })
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('type', 'DEDUCTION')

  if (error) return { success: false, error: error.message ?? 'Disable failed' }
  revalidatePath(DEDUCTIONS_PATH)
  return { success: true }
}

export async function activateDeduction(id: string): Promise<DeductionActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }
  const { supabase, orgId } = ctx

  const check = await assertDeductionRow(supabase, orgId, id)
  if ('error' in check) return { success: false, error: check.error }

  const { error } = await supabase
    .from('salary_components')
    .update({ is_active: true })
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('type', 'DEDUCTION')

  if (error) return { success: false, error: error.message ?? 'Activate failed' }
  revalidatePath(DEDUCTIONS_PATH)
  return { success: true }
}
