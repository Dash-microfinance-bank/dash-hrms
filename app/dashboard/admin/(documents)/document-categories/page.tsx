import React, { Suspense } from 'react'
import { DocumentCategoriesTableWithData } from '@/components/dashboard/DocumentCategoriesTableWithData'
import { DocumentCategoriesTableSkeleton } from '@/components/dashboard/DocumentCategoriesTableSkeleton'

const DocumentCategoriesPage = () => {
  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold mb-2">Document Categories</h1>
      <p className="text-muted-foreground">
        Manage organization document categories and their structure.
      </p>
      <div className="mt-6">
        <Suspense fallback={<DocumentCategoriesTableSkeleton />}>
          <DocumentCategoriesTableWithData />
        </Suspense>
      </div>
    </section>
  )
}

export default DocumentCategoriesPage