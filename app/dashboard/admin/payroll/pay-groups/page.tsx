import { Metadata } from 'next'
import React from 'react'
import { PayGroupsTable } from '@/components/dashboard/PayGroupsTable'
import { getPayGroupsForCurrentOrg } from '@/lib/data/pay-groups'

export const metadata: Metadata = {
  title: 'Pay Groups',
  description: 'Pay Groups',
}

const PayGroupsPage = async () => {
  const payGroups = await getPayGroupsForCurrentOrg()

  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold mb-2">Pay Groups</h1>
      <p className="text-muted-foreground">
        Manage organization pay groups and their structure.
      </p>
      <div className="mt-6">
        <PayGroupsTable data={payGroups} />
      </div>
    </section>
  )
}

export default PayGroupsPage