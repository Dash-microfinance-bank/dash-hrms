import { Metadata } from 'next'
import React from 'react'
import { AllowancesTable } from '@/components/dashboard/AllowancesTable'
import { getSalaryComponentsForCurrentOrg } from '@/lib/data/salary-components'

export const metadata: Metadata = {
  title: 'Allowances',
  description: 'Allowances',
}

export default async function AllowancesPage() {
  const allowances = await getSalaryComponentsForCurrentOrg('ALLOWANCE')

  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold mb-2">Allowances</h1>
      <p className="text-muted-foreground">
        Manage organization allowances and their structure.
      </p>
      <div className="mt-6">
        <AllowancesTable data={allowances} />
      </div>
    </section>
  )
}