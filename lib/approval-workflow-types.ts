export const APPROVAL_WORKFLOW_TYPE_OPTIONS = [
  { value: 'PAYROLL', label: 'Payroll' },
  { value: 'LEAVE', label: 'Leave' },
] as const

export type ApprovalWorkflowType = (typeof APPROVAL_WORKFLOW_TYPE_OPTIONS)[number]['value']

const TYPE_LABEL_BY_VALUE: Record<ApprovalWorkflowType, string> = {
  PAYROLL: 'Payroll',
  LEAVE: 'Leave',
}

export function getApprovalWorkflowTypeLabel(
  type: string | null | undefined
): string | null {
  if (!type) return null
  if (type in TYPE_LABEL_BY_VALUE) {
    return TYPE_LABEL_BY_VALUE[type as ApprovalWorkflowType]
  }
  return null
}

export function isApprovalWorkflowType(value: string): value is ApprovalWorkflowType {
  return APPROVAL_WORKFLOW_TYPE_OPTIONS.some((option) => option.value === value)
}
