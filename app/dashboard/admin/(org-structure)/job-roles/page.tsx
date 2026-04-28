import React, { Suspense } from 'react'
import { JobRolesTableSkeleton } from '@/components/dashboard/JobRolesTableSkeleton'
import { JobRolesTableWithData } from '@/components/dashboard/JobRolesTableWithData'

export default function JobRolesPage() {
  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold mb-2">Job roles</h1>
      <p className="text-muted-foreground">
        Define and manage job roles and positions within the organization.
      </p>
      <div className="mt-6">
        <Suspense fallback={<JobRolesTableSkeleton />}>
          <JobRolesTableWithData />
        </Suspense>
      </div>
    </section>
  )
}
