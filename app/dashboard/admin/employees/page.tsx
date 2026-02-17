import React, { Suspense } from 'react'
import { EmployeesTableSkeleton } from '@/components/dashboard/EmployeesTableSkeleton'
import { EmployeesTableWithData } from '../../../../components/dashboard/EmployeesTableWithData'

export default function EmployeesPage() {
  return (
    <section className="p-4">
      <h1 className="mb-2 text-2xl font-semibold">Employees</h1>
      <p className="text-muted-foreground">
        View and manage employee records, profiles, and information.
      </p>
      <div className="mt-6">
        <Suspense fallback={<EmployeesTableSkeleton />}>
          <EmployeesTableWithData />
        </Suspense>
      </div>
    </section>
  )
}
