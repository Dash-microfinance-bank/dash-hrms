import { getDocumentCategoriesForCurrentOrg } from '@/lib/data/document-categories'
import { DocumentCategoriesTable } from '@/components/dashboard/DocumentCategoriesTable'

/**
 * Server component: loads document categories (system defaults + current org's)
 * and passes them to the table. Multi-tenant: each org only sees its own + system.
 */
export async function DocumentCategoriesTableWithData() {
  const categories = await getDocumentCategoriesForCurrentOrg()
  return <DocumentCategoriesTable data={categories} />
}
