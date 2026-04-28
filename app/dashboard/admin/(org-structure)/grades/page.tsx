import { Suspense } from 'react'
import { GradesTableWithData } from '@/components/dashboard/GradesTableWithData'
import { GradesTableSkeleton } from '@/components/dashboard/GradesTableSkeleton'

export default function GradesPage() {
  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold mb-2">Grades</h1>
      <p className="text-muted-foreground">
        Manage employee grades, levels, and compensation structures.
      </p>
      <div className="mt-6">
        <Suspense fallback={<GradesTableSkeleton />}>
          <GradesTableWithData />
        </Suspense>
      </div>
    </section>
  )
}
