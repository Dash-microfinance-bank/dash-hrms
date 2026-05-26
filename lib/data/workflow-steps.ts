'use server'

import { createClient } from '@/lib/supabase/server'
import {
  formatApproverRoleSlug,
  isApproverRoleSlug,
  isUserApproverStep,
  pickUserRoleSlugForStep,
  type ApproverRoleSlug,
} from '@/lib/approval-workflow-roles'
import {
  getApprovalWorkflowByIdForCurrentOrg,
  getOrgUsersForApproverPicker,
  type ApprovalWorkflowDetailMeta,
  type OrgUserForApproverPicker,
} from '@/lib/data/approval-workflows'

export type WorkflowStepRow = {
  id: string
  stepOrder: number
  approverType: 'ROLE' | 'USER'
  approverRoleSlug: ApproverRoleSlug | null
  userId: string | null
  displayName: string
  avatarUrl: string | null
}

type DbWorkflowStep = {
  id: string
  workflow_id: string
  step_order: number
  role: string | null
  approver_type: string | null
  user_id: string | null
}

function resolveRoleSlug(
  row: DbWorkflowStep,
  requestType: string,
  profileRoles?: string[]
): ApproverRoleSlug | null {
  if (row.role && isApproverRoleSlug(row.role)) {
    return row.role
  }
  if (isApproverRoleSlug(row.approver_type ?? '')) {
    return row.approver_type as ApproverRoleSlug
  }
  if (profileRoles?.length) {
    return pickUserRoleSlugForStep(profileRoles, requestType)
  }
  return null
}

export type ApprovalWorkflowDetailPayload = {
  workflow: ApprovalWorkflowDetailMeta
  steps: WorkflowStepRow[]
  users: OrgUserForApproverPicker[]
}

function mapStepRow(
  row: DbWorkflowStep,
  profileById: Map<string, { full_name: string | null; avatar_url: string | null; roles: string[] }>,
  requestType: string
): WorkflowStepRow {
  if (isUserApproverStep(row.approver_type) && row.user_id) {
    const profile = profileById.get(row.user_id)
    const roles = profile?.roles ?? []
    const slug = resolveRoleSlug(row, requestType, roles)
    return {
      id: row.id,
      stepOrder: row.step_order,
      approverType: 'USER',
      approverRoleSlug: slug,
      userId: row.user_id,
      displayName: profile?.full_name?.trim() || 'Unknown user',
      avatarUrl: profile?.avatar_url ?? null,
    }
  }

  const slug = resolveRoleSlug(row, requestType)

  return {
    id: row.id,
    stepOrder: row.step_order,
    approverType: 'ROLE',
    approverRoleSlug: slug,
    userId: null,
    displayName: formatApproverRoleSlug(slug),
    avatarUrl: null,
  }
}

export async function getWorkflowStepsForWorkflow(
  workflowId: string,
  requestType: string
): Promise<WorkflowStepRow[]> {
  const supabase = await createClient()
  const users = await getOrgUsersForApproverPicker()
  const profileById = new Map(users.map((u) => [u.id, u]))

  const { data, error } = await supabase
    .from('workflow_steps')
    .select('id, workflow_id, step_order, role, approver_type, user_id')
    .eq('workflow_id', workflowId)
    .order('step_order', { ascending: true })

  if (error || !data) {
    console.error('[WorkflowSteps] Failed to fetch steps:', error)
    return []
  }

  return (data as DbWorkflowStep[]).map((row) => mapStepRow(row, profileById, requestType))
}

export async function getApprovalWorkflowDetail(
  workflowId: string
): Promise<ApprovalWorkflowDetailPayload | null> {
  const workflow = await getApprovalWorkflowByIdForCurrentOrg(workflowId)
  if (!workflow) return null

  const [steps, users] = await Promise.all([
    getWorkflowStepsForWorkflow(workflowId, workflow.requestType),
    getOrgUsersForApproverPicker(),
  ])

  return { workflow, steps, users }
}
