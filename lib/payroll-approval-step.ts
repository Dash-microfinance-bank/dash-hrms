import {
  isApproverRoleSlug,
  isUserApproverStep,
  pickUserRoleSlugForStep,
} from '@/lib/approval-workflow-roles'
import type { createClient } from '@/lib/supabase/server'

type TemplateStepRow = {
  role: string | null
  approver_type: string | null
  user_id: string | null
}

/** Resolve role slug from workflow_steps (handles legacy rows with role only in approver_type). */
export async function resolvePayrollTemplateStepRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  step: TemplateStepRow
): Promise<string | null> {
  const trimmed = step.role?.trim()
  if (trimmed) return trimmed

  const approverType = step.approver_type ?? ''
  if (isApproverRoleSlug(approverType)) return approverType

  if (isUserApproverStep(approverType) && step.user_id) {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', step.user_id)

    const roles = (data ?? []).map((r) => r.role)
    return pickUserRoleSlugForStep(roles, 'PAYROLL')
  }

  return null
}

/** Whether the signed-in user may act on this approval_steps row. */
export function canUserActOnApprovalStep(
  approverType: string | null,
  approverId: string | null,
  role: string | null,
  userId: string,
  userRoles: string[]
): boolean {
  if (!approverType) return false

  if (isUserApproverStep(approverType)) {
    return approverId === userId
  }

  if (approverType === 'ROLE') {
    return Boolean(role && isApproverRoleSlug(role) && userRoles.includes(role))
  }

  if (isApproverRoleSlug(approverType)) {
    return userRoles.includes(approverType)
  }

  return false
}
