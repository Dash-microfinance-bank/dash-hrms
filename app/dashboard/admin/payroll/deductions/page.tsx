import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { DeductionsTableWithData } from '@/components/dashboard/DeductionsTableWithData'
import { DeductionsTableSkeleton } from '@/components/dashboard/DeductionsTableSkeleton'

export const metadata: Metadata = {
  title: 'Deductions',
  description: 'Organization payroll deductions',
}

export default function DeductionsPage() {
  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold mb-2">Deductions</h1>
      <p className="text-muted-foreground">
        Manage organization deductions and their structure.
      </p>
      <div className="mt-6">
        <Suspense fallback={<DeductionsTableSkeleton />}>
          <DeductionsTableWithData />
        </Suspense>
      </div>
    </section>
  )
}
