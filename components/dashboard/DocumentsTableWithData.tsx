import { getAdminDocumentsForOrg } from '@/lib/data/admin-documents'
import { DocumentsTable } from '@/components/dashboard/DocumentsTable'

/**
 * Server component: loads all approved org documents and passes them to the
 * client-side table. Runs inside a Suspense boundary.
 */
export async function DocumentsTableWithData() {
  const documents = await getAdminDocumentsForOrg()
  return <DocumentsTable data={documents} />
}
