import React, { Suspense } from 'react'
import { LocationsTableSkeleton } from '@/components/dashboard/LocationsTableSkeleton'
import { LocationsTableWithData } from '@/components/dashboard/LocationsTableWithData'

export default function LocationsPage() {
  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold mb-2">Office Locations</h1>
      <p className="text-muted-foreground">
        Manage your organization&apos;s office locations and their structure.
      </p>
      <div className="mt-6">
        <Suspense fallback={<LocationsTableSkeleton />}>
          <LocationsTableWithData />
        </Suspense>
      </div>
    </section>
  )
}