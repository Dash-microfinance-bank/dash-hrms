'use server'

import { revalidatePath } from 'next/cache'
import { isUserApproverStep } from '@/lib/approval-workflow-roles'
import { getPayrollAdminContext } from '@/lib/actions/payroll-runs'
import {
  canUserActOnApprovalStep,
  resolvePayrollTemplateStepRole,
} from '@/lib/payroll-approval-step'
import {
  OPEN_APPROVAL_REQUEST_STATUSES,
  PAYROLL_APPROVAL_ENTITY_TYPE,
  PAYROLL_APPROVAL_REQUEST_TYPE,
  PAYROLL_APPROVAL_SOURCE,
} from '@/lib/payroll-approval-constants'

const PAYROLL_PATH = '/dashboard/admin/payroll'

export type PayrollApprovalActionResult =
  | { success: true }
  | { success: false; error: string }

type ReviewDecision = 'approve' | 'reject'

function revalidatePayrollRun(payrollRunId: string) {
  revalidatePath(PAYROLL_PATH)
  revalidatePath(`${PAYROLL_PATH}/${payrollRunId}`)
}

export async function submitPayrollRunForApproval(
  payrollRunId: string
): Promise<PayrollApprovalActionResult> {
  const ctx = await getPayrollAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const { supabase, orgId } = ctx

  const { data: run, error: runError } = await supabase
    .from('payroll_runs')
    .select('id, status')
    .eq('id', payrollRunId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (runError || !run) {
    return { success: false, error: 'Payroll run not found' }
  }

  if (run.status !== 'DRAFT') {
    return { success: false, error: 'Only draft payroll runs can be submitted for approval' }
  }

  const { count: entryCount, error: entryError } = await supabase
    .from('payroll_entries')
    .select('id', { count: 'exact', head: true })
    .eq('payroll_run_id', payrollRunId)

  if (entryError) {
    return { success: false, error: entryError.message }
  }
  if (!entryCount) {
    return { success: false, error: 'Save draft before submitting for approval' }
  }

  const { data: existingRequest } = await supabase
    .from('approval_requests')
    .select('id, status')
    .eq('organization_id', orgId)
    .eq('request_type', PAYROLL_APPROVAL_REQUEST_TYPE)
    .eq('entity_type', PAYROLL_APPROVAL_ENTITY_TYPE)
    .eq('entity_id', payrollRunId)
    .in('status', [...OPEN_APPROVAL_REQUEST_STATUSES])
    .maybeSingle()

  if (existingRequest) {
    return { success: false, error: 'This payroll run is already pending approval' }
  }

  const { data: workflow } = await supabase
    .from('approval_workflows')
    .select('id')
    .eq('organization_id', orgId)
    .eq('request_type', 'PAYROLL')
    .maybeSingle()

  if (!workflow) {
    return {
      success: false,
      error: 'No Payroll approval workflow configured. Create one in Approval Workflow settings.',
    }
  }

  const { data: templateSteps, error: templateError } = await supabase
    .from('workflow_steps')
    .select('step_order, role, approver_type, user_id')
    .eq('workflow_id', workflow.id)
    .order('step_order', { ascending: true })

  if (templateError) {
    return { success: false, error: templateError.message }
  }
  if (!templateSteps?.length) {
    return {
      success: false,
      error: 'Payroll approval workflow has no steps. Add steps before submitting.',
    }
  }

  const now = new Date().toISOString()

  const { data: request, error: requestError } = await supabase
    .from('approval_requests')
    .insert({
      organization_id: orgId,
      employee_id: null,
      status: 'pending',
      request_type: PAYROLL_APPROVAL_REQUEST_TYPE,
      entity_type: PAYROLL_APPROVAL_ENTITY_TYPE,
      entity_id: payrollRunId,
      source: PAYROLL_APPROVAL_SOURCE,
      submitted_at: now,
    })
    .select('id')
    .single()

  if (requestError || !request) {
    return { success: false, error: requestError?.message ?? 'Failed to create approval request' }
  }

  const approvalStepRows: Array<{
    organization_id: string
    approval_request_id: string
    step_order: number
    role: string
    approver_type: string
    approver_id: string | null
    status: string
  }> = []

  for (const step of templateSteps) {
    const roleSlug = await resolvePayrollTemplateStepRole(supabase, orgId, step)
    if (!roleSlug) {
      return {
        success: false,
        error:
          'Payroll workflow template has an invalid step (missing role). Edit the workflow and re-save each step.',
      }
    }

    if (isUserApproverStep(step.approver_type) && step.user_id) {
      approvalStepRows.push({
        organization_id: orgId,
        approval_request_id: request.id,
        step_order: step.step_order,
        role: roleSlug,
        approver_type: 'USER',
        approver_id: step.user_id,
        status: 'pending',
      })
      continue
    }

    approvalStepRows.push({
      organization_id: orgId,
      approval_request_id: request.id,
      step_order: step.step_order,
      role: roleSlug,
      approver_type: 'ROLE',
      approver_id: null,
      status: 'pending',
    })
  }

  const { error: stepsInsertError } = await supabase
    .from('approval_steps')
    .insert(approvalStepRows)

  if (stepsInsertError) {
    await supabase.from('approval_requests').delete().eq('id', request.id)
    return { success: false, error: stepsInsertError.message }
  }

  revalidatePayrollRun(payrollRunId)
  return { success: true }
}

export async function reviewPayrollApprovalStep(
  payrollRunId: string,
  stepId: string,
  decision: ReviewDecision
): Promise<PayrollApprovalActionResult> {
  const ctx = await getPayrollAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const { supabase, orgId, userId } = ctx

  const { data: run } = await supabase
    .from('payroll_runs')
    .select('id')
    .eq('id', payrollRunId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!run) return { success: false, error: 'Payroll run not found' }

  const { data: request } = await supabase
    .from('approval_requests')
    .select('id, status')
    .eq('organization_id', orgId)
    .eq('request_type', PAYROLL_APPROVAL_REQUEST_TYPE)
    .eq('entity_type', PAYROLL_APPROVAL_ENTITY_TYPE)
    .eq('entity_id', payrollRunId)
    .in('status', [...OPEN_APPROVAL_REQUEST_STATUSES])
    .maybeSingle()

  if (!request) {
    return { success: false, error: 'No pending payroll approval request found' }
  }

  const { data: steps } = await supabase
    .from('approval_steps')
    .select('id, step_order, role, approver_type, approver_id, status')
    .eq('approval_request_id', request.id)
    .order('step_order', { ascending: true })

  if (!steps?.length) {
    return { success: false, error: 'Approval steps not found' }
  }

  const currentPending = steps.find((s) => s.status === 'pending')
  if (!currentPending) {
    return { success: false, error: 'No pending approval step' }
  }

  if (currentPending.id !== stepId) {
    return { success: false, error: 'Only the current pending step can be reviewed' }
  }

  const { data: rolesData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', orgId)

  const userRoles = (rolesData ?? []).map((r) => r.role as string)

  const canAct = canUserActOnApprovalStep(
    currentPending.approver_type,
    currentPending.approver_id,
    currentPending.role,
    userId,
    userRoles
  )
  if (!canAct) {
    return { success: false, error: 'You are not authorized to review this step' }
  }

  const now = new Date().toISOString()

  if (decision === 'reject') {
    const { error: stepError } = await supabase
      .from('approval_steps')
      .update({ status: 'rejected', acted_at: now })
      .eq('id', stepId)
      .eq('approval_request_id', request.id)

    if (stepError) return { success: false, error: stepError.message }

    const { error: requestError } = await supabase
      .from('approval_requests')
      .update({
        status: 'rejected',
        reviewed_by: userId,
        reviewed_at: now,
      })
      .eq('id', request.id)

    if (requestError) return { success: false, error: requestError.message }

    revalidatePayrollRun(payrollRunId)
    return { success: true }
  }

  const { error: stepError } = await supabase
    .from('approval_steps')
    .update({ status: 'approved', acted_at: now })
    .eq('id', stepId)
    .eq('approval_request_id', request.id)

  if (stepError) return { success: false, error: stepError.message }

  const remainingPending = steps.filter(
    (s) => s.status === 'pending' && s.id !== stepId
  ).length

  if (remainingPending > 0) {
    const { error: requestError } = await supabase
      .from('approval_requests')
      .update({ status: 'pending' })
      .eq('id', request.id)

    if (requestError) return { success: false, error: requestError.message }
  } else {
    const { error: requestError } = await supabase
      .from('approval_requests')
      .update({
        status: 'approved',
        reviewed_by: userId,
        reviewed_at: now,
        rejection_reason: null,
      })
      .eq('id', request.id)

    if (requestError) return { success: false, error: requestError.message }

    const { error: runUpdateError } = await supabase
      .from('payroll_runs')
      .update({ status: 'APPROVED' })
      .eq('id', payrollRunId)
      .eq('organization_id', orgId)

    if (runUpdateError) return { success: false, error: runUpdateError.message }
  }

  revalidatePayrollRun(payrollRunId)
  return { success: true }
}
