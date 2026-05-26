import { Suspense } from 'react'
import { ApprovalWorkflowDetailSkeleton } from '@/components/dashboard/ApprovalWorkflowDetailSkeleton'
import { ApprovalWorkflowDetailWithData } from '@/components/dashboard/ApprovalWorkflowDetailWithData'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ApprovalWorkflowDetailPage({ params }: PageProps) {
  const { id } = await params

  return (
    <Suspense fallback={<ApprovalWorkflowDetailSkeleton />}>
      <ApprovalWorkflowDetailWithData id={id} />
    </Suspense>
  )
}
