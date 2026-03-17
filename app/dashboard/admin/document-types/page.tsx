import React, { Suspense } from 'react'
import { DocumentTypesTableWithData } from '@/components/dashboard/DocumentTypesTableWithData'
import { DocumentTypesTableSkeleton } from '@/components/dashboard/DocumentTypesTableSkeleton'

const DocumentTypesPage = () => {
  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold mb-2">Document Types</h1>
      <p className="text-muted-foreground">
        Manage organization document types and their structure.
      </p>
      <div className="mt-6">
        <Suspense fallback={<DocumentTypesTableSkeleton />}>
          <DocumentTypesTableWithData />
        </Suspense>
      </div>
    </section>
  )
}

export default DocumentTypesPage