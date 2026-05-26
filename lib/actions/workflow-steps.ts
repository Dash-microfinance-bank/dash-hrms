'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  getApproverRoleOptions,
  isApproverRoleSlug,
  type ApproverRoleSlug,
} from '@/lib/approval-workflow-roles'

const ADMIN_ROLES = ['super_admin', 'hr', 'finance'] as const
const APPROVAL_WORKFLOW_PATH = '/dashboard/admin/approval-workflow'

export type WorkflowStepActionResult =
  | { success: true }
  | { success: false; error: string }

type StepInput = {
  approverType: 'ROLE' | 'USER'
  approverRoleSlug: ApproverRoleSlug
  userId?: string | null
}

async function getAdminContext() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' } as const
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return { error: 'Organization not found' } as const
  }

  const orgId = profile.organization_id

  const { data: rolesData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)

  const roles = (rolesData ?? []).map((r) => r.role as string)
  const hasAdminRole = roles.some((r) => ADMIN_ROLES.includes(r as (typeof ADMIN_ROLES)[number]))

  if (!hasAdminRole) {
    return { error: 'You do not have permission to manage approval workflows' } as const
  }

  return { supabase, orgId } as { supabase: typeof supabase; orgId: string }
}

async function getWorkflowForOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  workflowId: string
) {
  const { data, error } = await supabase
    .from('approval_workflows')
    .select('id, request_type')
    .eq('id', workflowId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (error || !data) return null
  return data
}

function validateStepInput(
  requestType: string,
  input: StepInput
): string | null {
  const allowed = getApproverRoleOptions(requestType, input.approverType).map((o) => o.value)
  if (!allowed.includes(input.approverRoleSlug)) {
    return 'Approver role is not allowed for this workflow type'
  }

  if (input.approverType === 'USER') {
    if (!input.userId) return 'Select an approver'
    return null
  }

  if (!isApproverRoleSlug(input.approverRoleSlug)) {
    return 'Invalid approver role'
  }

  return null
}

async function assertUserHasRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  userId: string,
  roleSlug: ApproverRoleSlug
): Promise<string | null> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .eq('role', roleSlug)
    .maybeSingle()

  if (!data) return 'Selected user does not have the required role'
  return null
}

function toDbFields(input: StepInput): {
  role: ApproverRoleSlug
  approver_type: 'ROLE' | 'USER'
  user_id: string | null
} {
  if (input.approverType === 'USER') {
    return {
      role: input.approverRoleSlug,
      approver_type: 'USER',
      user_id: input.userId ?? null,
    }
  }
  return {
    role: input.approverRoleSlug,
    approver_type: 'ROLE',
    user_id: null,
  }
}

function revalidateWorkflow(workflowId: string) {
  revalidatePath(APPROVAL_WORKFLOW_PATH)
  revalidatePath(`${APPROVAL_WORKFLOW_PATH}/${workflowId}`)
}

export async function createWorkflowStep(
  workflowId: string,
  input: StepInput
): Promise<WorkflowStepActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const { supabase, orgId } = ctx
  const workflow = await getWorkflowForOrg(supabase, orgId, workflowId)
  if (!workflow) return { success: false, error: 'Workflow not found' }

  const requestType = workflow.request_type ?? 'PAYROLL'
  const validationError = validateStepInput(requestType, input)
  if (validationError) return { success: false, error: validationError }

  if (input.approverType === 'USER' && input.userId) {
    const roleError = await assertUserHasRole(supabase, orgId, input.userId, input.approverRoleSlug)
    if (roleError) return { success: false, error: roleError }
  }

  const { data: existingSteps } = await supabase
    .from('workflow_steps')
    .select('step_order')
    .eq('workflow_id', workflowId)
    .order('step_order', { ascending: false })
    .limit(1)

  const nextOrder =
    existingSteps && existingSteps.length > 0 ? Number(existingSteps[0].step_order) + 1 : 1

  const dbFields = toDbFields(input)

  const { error } = await supabase.from('workflow_steps').insert({
    organization_id: orgId,
    workflow_id: workflowId,
    step_order: nextOrder,
    role: dbFields.role,
    approver_type: dbFields.approver_type,
    user_id: dbFields.user_id,
  })

  if (error) return { success: false, error: error.message }

  revalidateWorkflow(workflowId)
  return { success: true }
}

export async function updateWorkflowStep(
  stepId: string,
  workflowId: string,
  input: StepInput
): Promise<WorkflowStepActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const { supabase, orgId } = ctx
  const workflow = await getWorkflowForOrg(supabase, orgId, workflowId)
  if (!workflow) return { success: false, error: 'Workflow not found' }

  const requestType = workflow.request_type ?? 'PAYROLL'
  const validationError = validateStepInput(requestType, input)
  if (validationError) return { success: false, error: validationError }

  if (input.approverType === 'USER' && input.userId) {
    const roleError = await assertUserHasRole(supabase, orgId, input.userId, input.approverRoleSlug)
    if (roleError) return { success: false, error: roleError }
  }

  const { data: step } = await supabase
    .from('workflow_steps')
    .select('id')
    .eq('id', stepId)
    .eq('workflow_id', workflowId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!step) return { success: false, error: 'Step not found' }

  const dbFields = toDbFields(input)

  const { error } = await supabase
    .from('workflow_steps')
    .update({
      role: dbFields.role,
      approver_type: dbFields.approver_type,
      user_id: dbFields.user_id,
    })
    .eq('id', stepId)
    .eq('organization_id', orgId)

  if (error) return { success: false, error: error.message }

  revalidateWorkflow(workflowId)
  return { success: true }
}

export async function saveWorkflowStepOrder(
  workflowId: string,
  orderedStepIds: string[],
  deleteStepIds: string[]
): Promise<WorkflowStepActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const { supabase, orgId } = ctx
  const workflow = await getWorkflowForOrg(supabase, orgId, workflowId)
  if (!workflow) return { success: false, error: 'Workflow not found' }

  if (deleteStepIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('workflow_steps')
      .delete()
      .eq('workflow_id', workflowId)
      .eq('organization_id', orgId)
      .in('id', deleteStepIds)

    if (deleteError) return { success: false, error: deleteError.message }
  }

  const idsToUpdate = orderedStepIds.filter((id) => !deleteStepIds.includes(id))

  for (let i = 0; i < idsToUpdate.length; i++) {
    const stepId = idsToUpdate[i]
    const { error } = await supabase
      .from('workflow_steps')
      .update({ step_order: i + 1 })
      .eq('id', stepId)
      .eq('workflow_id', workflowId)
      .eq('organization_id', orgId)

    if (error) return { success: false, error: error.message }
  }

  revalidateWorkflow(workflowId)
  return { success: true }
}
