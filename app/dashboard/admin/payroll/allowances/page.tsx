import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { AllowancesTableWithData } from '@/components/dashboard/AllowancesTableWithData'
import { AllowancesTableSkeleton } from '@/components/dashboard/AllowancesTableSkeleton'

export const metadata: Metadata = {
  title: 'Allowances',
  description: 'Allowances',
}

export default function AllowancesPage() {
  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold mb-2">Allowances</h1>
      <p className="text-muted-foreground">
        Manage organization allowances and their structure.
      </p>
      <div className="mt-6">
        <Suspense fallback={<AllowancesTableSkeleton />}>
          <AllowancesTableWithData />
        </Suspense>
      </div>
    </section>
  )
}
