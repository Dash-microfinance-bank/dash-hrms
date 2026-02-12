import React, { Suspense } from 'react'
import { DepartmentsTableSkeleton } from '@/components/dashboard/DepartmentsTableSkeleton'
import { DepartmentsTableWithData } from '@/components/dashboard/DepartmentsTableWithData'

export default function DepartmentsPage() {
  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold mb-2">Departments</h1>
      <p className="text-muted-foreground">
        Manage organization departments and their structure.
      </p>
      <div className="mt-6">
        <Suspense fallback={<DepartmentsTableSkeleton />}>
          <DepartmentsTableWithData />
        </Suspense>
      </div>
    </section>
  )
}
