import { Suspense } from 'react'
import { ApprovalWorkflowsTableWithData } from '@/components/dashboard/ApprovalWorkflowsTableWithData'
import { ApprovalWorkflowsTableSkeleton } from '@/components/dashboard/ApprovalWorkflowsTableSkeleton'

export default function ApprovalWorkflowPage() {
  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold mb-2">Approval Workflow</h1>
      <p className="text-muted-foreground">
        Manage the approval workflow for the organization.
      </p>
      <div className="mt-6">
        <Suspense fallback={<ApprovalWorkflowsTableSkeleton />}>
          <ApprovalWorkflowsTableWithData />
        </Suspense>
      </div>
    </section>
  )
}
