import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { PayGroupsTableWithData } from '@/components/dashboard/PayGroupsTableWithData'
import { PayGroupsTableSkeleton } from '@/components/dashboard/PayGroupsTableSkeleton'

export const metadata: Metadata = {
  title: 'Pay Groups',
  description: 'Pay Groups',
}

const PayGroupsPage = () => {
  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold mb-2">Pay Groups</h1>
      <p className="text-muted-foreground">
        Manage organization pay groups and their structure.
      </p>
      <div className="mt-6">
        <Suspense fallback={<PayGroupsTableSkeleton />}>
          <PayGroupsTableWithData />
        </Suspense>
      </div>
    </section>
  )
}

export default PayGroupsPage