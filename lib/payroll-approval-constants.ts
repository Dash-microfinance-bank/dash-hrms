export const PAYROLL_APPROVAL_REQUEST_TYPE = 'PAYROLL_APPROVAL' as const
export const PAYROLL_APPROVAL_ENTITY_TYPE = 'payroll_run' as const
export const PAYROLL_APPROVAL_SOURCE = 'PAYROLL_ADMIN' as const

export const OPEN_APPROVAL_REQUEST_STATUSES = ['pending', 'partially_approved'] as const

export type ApprovalRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'partially_approved'

export type ApprovalStepStatus = 'pending' | 'approved' | 'rejected'
