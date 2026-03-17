import { getDocumentTypesForCurrentOrg } from '@/lib/data/document-types'
import { getDocumentCategoriesForCurrentOrg } from '@/lib/data/document-categories'
import { DocumentTypesTable } from '@/components/dashboard/DocumentTypesTable'

/**
 * Server component: loads document types and categories for the current org
 * and passes them to the table. Categories are used for the create/edit dropdowns.
 */
export async function DocumentTypesTableWithData() {
  const [types, categories] = await Promise.all([
    getDocumentTypesForCurrentOrg(),
    getDocumentCategoriesForCurrentOrg(),
  ])
  return <DocumentTypesTable data={types} categories={categories} />
}
