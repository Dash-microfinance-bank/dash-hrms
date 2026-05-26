'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  APPROVAL_WORKFLOW_TYPE_OPTIONS,
  type ApprovalWorkflowType,
  isApprovalWorkflowType,
} from '@/lib/approval-workflow-types'

const ADMIN_ROLES = ['super_admin', 'hr', 'finance'] as const
const APPROVAL_WORKFLOW_PATH = '/dashboard/admin/approval-workflow'

export type ApprovalWorkflowActionResult =
  | { success: true }
  | { success: false; error: string }

type CreateApprovalWorkflowInput = {
  name: string
  requestType: string
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

function duplicateTypeMessage(requestType: ApprovalWorkflowType): string {
  const label =
    APPROVAL_WORKFLOW_TYPE_OPTIONS.find((o) => o.value === requestType)?.label ?? requestType
  return `A ${label} workflow already exists`
}

export async function createApprovalWorkflow(
  input: CreateApprovalWorkflowInput
): Promise<ApprovalWorkflowActionResult> {
  const ctx = await getAdminContext()
  if ('error' in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, orgId } = ctx
  const name = input.name.trim()
  const requestType = input.requestType.trim()

  if (!name) {
    return { success: false, error: 'Workflow name is required' }
  }

  if (!isApprovalWorkflowType(requestType)) {
    return { success: false, error: 'Invalid workflow type' }
  }

  const { data: existing } = await supabase
    .from('approval_workflows')
    .select('id')
    .eq('organization_id', orgId)
    .eq('request_type', requestType)
    .maybeSingle()

  if (existing) {
    return { success: false, error: duplicateTypeMessage(requestType) }
  }

  const { error } = await supabase.from('approval_workflows').insert({
    organization_id: orgId,
    name,
    request_type: requestType,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(APPROVAL_WORKFLOW_PATH)
  return { success: true }
}
