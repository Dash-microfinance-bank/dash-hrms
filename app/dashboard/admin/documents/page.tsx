import React, { Suspense } from 'react'
import { DocumentsTableWithData } from '@/components/dashboard/DocumentsTableWithData'
import { DocumentsTableSkeleton } from '@/components/dashboard/DocumentsTableSkeleton'

export default function DocumentsPage() {
  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold mb-2">Documents</h1>
      <p className="text-muted-foreground">
        View and manage all approved documents across the organization.
      </p>
      <div className="mt-6">
        <Suspense fallback={<DocumentsTableSkeleton />}>
          <DocumentsTableWithData />
        </Suspense>
      </div>
    </section>
  )
}