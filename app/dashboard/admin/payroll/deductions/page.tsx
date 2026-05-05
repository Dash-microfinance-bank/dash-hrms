import { Metadata } from 'next'
import React from 'react'
import { DeductionsTable } from '@/components/dashboard/DeductionsTable'
import { getDeductionsWithPayrollForCurrentOrg } from '@/lib/data/deductions'

export const metadata: Metadata = {
  title: 'Deductions',
  description: 'Organization payroll deductions',
}

export default async function DeductionsPage() {
  const deductions = await getDeductionsWithPayrollForCurrentOrg()

  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold mb-2">Deductions</h1>
      <p className="text-muted-foreground">
        Manage organization deductions and their structure.
      </p>
      <div className="mt-6">
        <DeductionsTable data={deductions} />
      </div>
    </section>
  )
}
