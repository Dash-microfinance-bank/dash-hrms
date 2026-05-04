import { Suspense } from 'react'
import { EarningStructureSummaryTableWithData } from '@/components/dashboard/EarningStructureSummaryTableWithData'
import { EarningStructureSummaryTableSkeleton } from '@/components/dashboard/EarningStructureSummaryTableSkeleton'

const EarningStructurePage = () => {
  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold mb-2">Earning Structures</h1>
      <p className="text-muted-foreground">
        Manage organization earning structures.
      </p>
      <div className="mt-6">
        <Suspense fallback={<EarningStructureSummaryTableSkeleton />}>
          <EarningStructureSummaryTableWithData />
        </Suspense>
      </div>
    </section>
  )
}

export default EarningStructurePage