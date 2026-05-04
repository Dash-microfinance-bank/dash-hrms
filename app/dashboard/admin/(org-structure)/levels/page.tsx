import { Suspense } from 'react'
import { LevelsTableWithData } from '@/components/dashboard/LevelsTableWithData'
import { LevelsTableSkeleton } from '@/components/dashboard/LevelsTableSkeleton'

export default function LevelsPage() {
  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold mb-2">Levels</h1>
      <p className="text-muted-foreground">
        Manage employee levels and their structure.
      </p>
      <div className="mt-6">
        <Suspense fallback={<LevelsTableSkeleton />}>
          <LevelsTableWithData />
        </Suspense>
      </div>
    </section>
  )
}