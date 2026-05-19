import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { PayrollRunsTableWithData } from '@/components/dashboard/PayrollRunsTableWithData'
import { PayrollRunsTableSkeleton } from '@/components/dashboard/PayrollRunsTableSkeleton'

export const metadata: Metadata = {
  title: 'Payroll',
  description: 'Payroll',
}

const PayrollPage = () => {
  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold mb-2">Payroll</h1>
      <p className="text-muted-foreground">Manage organization payroll runs.</p>
      <div className="mt-6">
        <Suspense fallback={<PayrollRunsTableSkeleton />}>
          <PayrollRunsTableWithData />
        </Suspense>
      </div>
    </section>
  )
}

export default PayrollPage
