import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmployeeDocumentsTabData } from '@/lib/data/employee-documents-tab'
import type {
  EmployeeDocumentsTabPayload,
  DocumentTypeTabItem,
  DocumentVersionCard,
} from '@/lib/data/employee-documents-tab'

export const runtime = 'nodejs'

// ─── Response types (re-exported so client components can import them) ────────

export type EmployeeDocumentsResponse = EmployeeDocumentsTabPayload
export type { DocumentTypeTabItem, DocumentVersionCard }

// ─── GET /api/employees/[id]/documents ───────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: employeeId } = await params

  // Verify caller is authenticated before delegating to the data helper.
  // The data helper performs the full org + employee tenancy guard, but we
  // want a clear 401 rather than a null payload if no session exists.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getEmployeeDocumentsTabData(employeeId)

  // null means either the org could not be resolved or the employee does not
  // belong to the caller's org — treat as not found.
  if (!payload) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(payload)
}
