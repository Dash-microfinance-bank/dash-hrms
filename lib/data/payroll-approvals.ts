'use server'

import { createClient } from '@/lib/supabase/server'
import { canUserActOnApprovalStep } from '@/lib/payroll-approval-step'
import {
  OPEN_APPROVAL_REQUEST_STATUSES,
  PAYROLL_APPROVAL_ENTITY_TYPE,
  PAYROLL_APPROVAL_REQUEST_TYPE,
  type ApprovalRequestStatus,
  type ApprovalStepStatus,
} from '@/lib/payroll-approval-constants'

export type PayrollApprovalStepSummary = {
  id: string
  stepOrder: number
  approverType: string
  approverId: string | null
  role: string | null
  status: ApprovalStepStatus
}

export type PayrollApprovalState = {
  requestId: string | null
  requestStatus: ApprovalRequestStatus | null
  hasOpenRequest: boolean
  canSubmit: boolean
  canReviewCurrentStep: boolean
  currentStepId: string | null
  currentStepOrder: number | null
  steps: PayrollApprovalStepSummary[]
}

const EMPTY_STATE: PayrollApprovalState = {
  requestId: null,
  requestStatus: null,
  hasOpenRequest: false,
  canSubmit: false,
  canReviewCurrentStep: false,
  currentStepId: null,
  currentStepOrder: null,
  steps: [],
}

function isOpenRequestStatus(status: string | null | undefined): boolean {
  return OPEN_APPROVAL_REQUEST_STATUSES.includes(
    status as (typeof OPEN_APPROVAL_REQUEST_STATUSES)[number]
  )
}

export async function getPayrollApprovalState(
  payrollRunId: string,
  options?: {
    runHasPersistedEntries?: boolean
    payrollRunStatus?: string | null
  }
): Promise<PayrollApprovalState> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return EMPTY_STATE

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) return EMPTY_STATE

  const orgId = profile.organization_id

  const { data: rolesData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)

  const userRoles = (rolesData ?? []).map((r) => r.role as string)

  const { data: request } = await supabase
    .from('approval_requests')
    .select('id, status')
    .eq('organization_id', orgId)
    .eq('request_type', PAYROLL_APPROVAL_REQUEST_TYPE)
    .eq('entity_type', PAYROLL_APPROVAL_ENTITY_TYPE)
    .eq('entity_id', payrollRunId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!request) {
    const canSubmit =
      Boolean(options?.runHasPersistedEntries) &&
      options?.payrollRunStatus === 'DRAFT'
    return { ...EMPTY_STATE, canSubmit }
  }

  const requestStatus = request.status as ApprovalRequestStatus
  const hasOpenRequest = isOpenRequestStatus(requestStatus)

  const { data: stepRows, error: stepsError } = await supabase
    .from('approval_steps')
    .select('id, step_order, role, approver_type, approver_id, status')
    .eq('approval_request_id', request.id)
    .order('step_order', { ascending: true })

  if (stepsError || !stepRows) {
    console.error('[PayrollApprovals] Failed to load approval steps:', stepsError)
    return { ...EMPTY_STATE, requestId: request.id, requestStatus, hasOpenRequest }
  }

  const steps: PayrollApprovalStepSummary[] = stepRows.map((row) => ({
    id: row.id,
    stepOrder: row.step_order,
    approverType: row.approver_type ?? '',
    approverId: row.approver_id,
    status: row.status as ApprovalStepStatus,
    role: row.role ?? null,
  }))

  const currentPending = steps.find((s) => s.status === 'pending') ?? null

  let canReviewCurrentStep = false
  if (hasOpenRequest && currentPending) {
    canReviewCurrentStep = canUserActOnApprovalStep(
      currentPending.approverType,
      currentPending.approverId,
      currentPending.role,
      user.id,
      userRoles
    )
  }

  const canSubmit =
    Boolean(options?.runHasPersistedEntries) &&
    options?.payrollRunStatus === 'DRAFT' &&
    !hasOpenRequest &&
    requestStatus !== 'approved'

  return {
    requestId: request.id,
    requestStatus,
    hasOpenRequest,
    canSubmit,
    canReviewCurrentStep,
    currentStepId: currentPending?.id ?? null,
    currentStepOrder: currentPending?.stepOrder ?? null,
    steps,
  }
}
