import type { ApprovalWorkflowType } from '@/lib/approval-workflow-types'

export type ApproverRoleSlug = 'manager' | 'hr' | 'finance' | 'super_admin'

export const APPROVER_ROLE_SLUGS: ApproverRoleSlug[] = [
  'manager',
  'hr',
  'finance',
  'super_admin',
]

const ROLE_LABEL_BY_SLUG: Record<ApproverRoleSlug, string> = {
  manager: 'Line Manager',
  hr: 'HR Admin',
  finance: 'Finance Admin',
  super_admin: 'Super Admin',
}

const ROLE_OPTIONS_BY_REQUEST_TYPE: Record<ApprovalWorkflowType, ApproverRoleSlug[]> = {
  PAYROLL: ['hr', 'finance', 'super_admin'],
  LEAVE: ['manager', 'hr', 'super_admin'],
}

export function isApproverRoleSlug(value: string): value is ApproverRoleSlug {
  return APPROVER_ROLE_SLUGS.includes(value as ApproverRoleSlug)
}

export function formatApproverRoleSlug(slug: string | null | undefined): string {
  if (!slug) return '—'
  if (isApproverRoleSlug(slug)) return ROLE_LABEL_BY_SLUG[slug]
  return slug
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function getApproverRoleOptions(
  requestType: string | null | undefined,
  approverType: 'ROLE' | 'USER' = 'ROLE'
) {
  const type =
    requestType === 'PAYROLL' || requestType === 'LEAVE' ? requestType : 'PAYROLL'
  let slugs = ROLE_OPTIONS_BY_REQUEST_TYPE[type]
  if (type === 'LEAVE' && approverType === 'USER') {
    slugs = slugs.filter((slug) => slug !== 'manager')
  }
  return slugs.map((value) => ({
    value,
    label: ROLE_LABEL_BY_SLUG[value],
  }))
}

export function isUserApproverStep(approverType: string | null | undefined): boolean {
  return approverType === 'USER'
}

export function pickUserRoleSlugForStep(
  userRoles: string[],
  requestType: string | null | undefined
): ApproverRoleSlug | null {
  const allowed = getApproverRoleOptions(requestType, 'USER').map((o) => o.value)
  return allowed.find((slug) => userRoles.includes(slug)) ?? null
}
