import { getApprovalWorkflowsForCurrentOrg } from '@/lib/data/approval-workflows'
import { ApprovalWorkflowsTable } from '@/components/dashboard/ApprovalWorkflowsTable'

export async function ApprovalWorkflowsTableWithData() {
  const workflows = await getApprovalWorkflowsForCurrentOrg()
  return <ApprovalWorkflowsTable data={workflows} />
}
