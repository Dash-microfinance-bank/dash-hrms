'use server'

import { createClient } from '@/lib/supabase/server'
import { getApprovalWorkflowTypeLabel } from '@/lib/approval-workflow-types'

export type ApprovalWorkflowRow = {
  id: string
  organization_id: string | null
  name: string | null
  request_type: string | null
  created_at: string
}

export type ApprovalWorkflowDetailMeta = {
  id: string
  name: string
  requestType: string
  workflowTypeLabel: string
}

export type OrgUserForApproverPicker = {
  id: string
  full_name: string | null
  avatar_url: string | null
  roles: string[]
}

async function getOrgIdForCurrentUser(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  return profile?.organization_id ?? null
}

export async function getApprovalWorkflowsForCurrentOrg(): Promise<ApprovalWorkflowRow[]> {
  const supabase = await createClient()
  const orgId = await getOrgIdForCurrentUser()
  if (!orgId) return []

  const { data, error } = await supabase
    .from('approval_workflows')
    .select('id, organization_id, name, request_type, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.error('[ApprovalWorkflows] Failed to fetch workflows:', error)
    return []
  }

  return data as ApprovalWorkflowRow[]
}

export async function getApprovalWorkflowByIdForCurrentOrg(
  id: string
): Promise<ApprovalWorkflowDetailMeta | null> {
  const supabase = await createClient()
  const orgId = await getOrgIdForCurrentUser()
  if (!orgId) return null

  const { data, error } = await supabase
    .from('approval_workflows')
    .select('id, name, request_type')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (error || !data) {
    console.error('[ApprovalWorkflows] Failed to fetch workflow:', error)
    return null
  }

  const requestType = data.request_type ?? 'PAYROLL'

  return {
    id: data.id,
    name: data.name ?? 'Approval workflow',
    requestType,
    workflowTypeLabel: getApprovalWorkflowTypeLabel(requestType) ?? requestType,
  }
}

export async function getOrgUsersForApproverPicker(): Promise<OrgUserForApproverPicker[]> {
  const supabase = await createClient()
  const orgId = await getOrgIdForCurrentUser()
  if (!orgId) return []

  const [profilesRes, rolesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('organization_id', orgId)
      .order('full_name', { ascending: true }),
    supabase.from('user_roles').select('user_id, role').eq('organization_id', orgId),
  ])

  if (profilesRes.error || rolesRes.error) {
    console.error('[ApprovalWorkflows] Failed to fetch users:', profilesRes.error ?? rolesRes.error)
    return []
  }

  const rolesByUserId = new Map<string, string[]>()
  for (const r of rolesRes.data ?? []) {
    const list = rolesByUserId.get(r.user_id) ?? []
    list.push(r.role as string)
    rolesByUserId.set(r.user_id, list)
  }

  return (profilesRes.data ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name ?? null,
    avatar_url: p.avatar_url ?? null,
    roles: rolesByUserId.get(p.id) ?? [],
  }))
}
