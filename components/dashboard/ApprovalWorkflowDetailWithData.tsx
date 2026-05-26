import { notFound } from 'next/navigation'
import { ApprovalWorkflowDetailClient } from '@/components/dashboard/ApprovalWorkflowDetailClient'
import { getApprovalWorkflowDetail } from '@/lib/data/workflow-steps'

type ApprovalWorkflowDetailWithDataProps = {
  id: string
}

export async function ApprovalWorkflowDetailWithData({ id }: ApprovalWorkflowDetailWithDataProps) {
  const detail = await getApprovalWorkflowDetail(id)

  if (!detail) {
    notFound()
  }

  return (
    <ApprovalWorkflowDetailClient
      workflow={detail.workflow}
      initialSteps={detail.steps}
      users={detail.users}
    />
  )
}
