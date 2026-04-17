'use server'

import { createClient } from '@/lib/supabase/server'

// ─── DTO ──────────────────────────────────────────────────────────────────────

export type AdminDocumentRow = {
  /** documents.id */
  id: string
  /** documents.title */
  title: string
  /** documents.employee_id — null for org/dept level documents */
  employeeId: string | null
  /** Resolved display name for the "For" column */
  forLabel: string
  /** Optional email fallback when biodata name is unavailable */
  employeeEmail: string | null
  /** document_types.owner_type */
  ownerType: 'USER' | 'ORGANIZATION' | 'DEPARTMENT' | null
  /** document_types.name */
  documentTypeName: string
  /** document_categories.name */
  documentCategoryName: string | null
  /** documents.issue_date */
  issueDate: string | null
  /** documents.expiry_date */
  expiryDate: string | null
  /** document_versions.uploaded_at */
  uploadedAt: string | null
  /** document_versions.file_url */
  fileUrl: string | null
  /** document_versions.storage_object_path */
  storageObjectPath: string | null
  /** document_versions.file_name */
  fileName: string | null
  /** documents.current_version_id */
  versionId: string | null
}

// ─── Raw DB shapes ─────────────────────────────────────────────────────────────

type RawDocument = {
  id: string
  title: string
  employee_id: string | null
  document_type_id: string
  current_version_id: string | null
  issue_date: string | null
  expiry_date: string | null
}

type RawVersion = {
  id: string
  document_id: string
  file_url: string | null
  storage_object_path: string | null
  file_name: string | null
  uploaded_at: string
}

type RawDocumentType = {
  id: string
  name: string
  category_id: string | null
  owner_type: string | null
}

type RawCategory = {
  id: string
  name: string
}

type RawEmployee = {
  id: string
  email: string | null
}

type RawBiodata = {
  employee_id: string
  firstname: string | null
  lastname: string | null
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

/**
 * Fetches all approved documents for the current user's organization.
 * "Approved" means the document has a non-null `current_version_id` and
 * `status = 'approved'`.
 *
 * All queries are scoped to the caller's org for multi-tenancy.
 * Returns [] when unauthenticated or org cannot be resolved.
 */
export async function getAdminDocumentsForOrg(): Promise<AdminDocumentRow[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!myProfile?.organization_id) return []

  const orgId = myProfile.organization_id as string

  // 1. Fetch approved documents for this org.
  const { data: rawDocs, error: docsError } = await supabase
    .from('documents')
    .select('id, title, employee_id, document_type_id, current_version_id, issue_date, expiry_date')
    .eq('organization_id', orgId)
    .eq('status', 'approved')
    .not('current_version_id', 'is', null)
    .order('created_at', { ascending: false })

  if (docsError) {
    console.error('[admin-documents] Failed to fetch documents:', docsError)
    return []
  }

  const docs = (rawDocs ?? []) as RawDocument[]
  if (docs.length === 0) return []

  const versionIds = docs
    .map((d) => d.current_version_id)
    .filter((id): id is string => !!id)
  const typeIds = [...new Set(docs.map((d) => d.document_type_id))]
  const employeeIds = [...new Set(docs.map((d) => d.employee_id).filter((id): id is string => !!id))]

  // 2. Parallel lookups.
  const [versionsRes, typesRes, employeesRes, biodataRes] = await Promise.all([
    supabase
      .from('document_versions')
      .select('id, document_id, file_url, storage_object_path, file_name, uploaded_at')
      .in('id', versionIds),
    supabase
      .from('document_types')
      .select('id, name, category_id, owner_type')
      .in('id', typeIds),
    employeeIds.length > 0
      ? supabase
          .from('employees')
          .select('id, email')
          .in('id', employeeIds)
          .eq('organization_id', orgId)
      : Promise.resolve({ data: [], error: null }),
    employeeIds.length > 0
      ? supabase
          .from('employee_biodata')
          .select('employee_id, firstname, lastname')
          .in('employee_id', employeeIds)
          .eq('organization_id', orgId)
      : Promise.resolve({ data: [], error: null }),
  ])

  const versions = (versionsRes.data ?? []) as RawVersion[]
  const types = (typesRes.data ?? []) as RawDocumentType[]
  const employees = (employeesRes.data ?? []) as RawEmployee[]
  const biodata = (biodataRes.data ?? []) as RawBiodata[]

  // 3. Resolve category names for found type category_ids.
  const categoryIds = [...new Set(types.map((t) => t.category_id).filter((id): id is string => !!id))]
  const categoriesRes = categoryIds.length > 0
    ? await supabase
        .from('document_categories')
        .select('id, name')
        .in('id', categoryIds)
    : { data: [] }
  const categories = (categoriesRes.data ?? []) as RawCategory[]

  // 4. Build lookup maps.
  const versionById = new Map(versions.map((v) => [v.id, v]))
  const typeById = new Map(types.map((t) => [t.id, t]))
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const employeeById = new Map(employees.map((e) => [e.id, e]))
  const biodataByEmployeeId = new Map(biodata.map((b) => [b.employee_id, b]))

  // 5. Assemble rows.
  return docs.map((doc): AdminDocumentRow => {
    const ver = doc.current_version_id ? versionById.get(doc.current_version_id) ?? null : null
    const docType = typeById.get(doc.document_type_id)
    const category = docType?.category_id ? categoryById.get(docType.category_id) ?? null : null
    const employee = doc.employee_id ? employeeById.get(doc.employee_id) ?? null : null
    const bio = doc.employee_id ? biodataByEmployeeId.get(doc.employee_id) ?? null : null

    const ownerType = (docType?.owner_type ?? null) as AdminDocumentRow['ownerType']
    let forLabel: string
    if (ownerType === 'USER') {
      const name = [bio?.firstname, bio?.lastname].filter(Boolean).join(' ')
      forLabel = name || employee?.email || 'Employee'
    } else if (ownerType === 'DEPARTMENT') {
      forLabel = 'Department'
    } else {
      forLabel = 'Company'
    }

    return {
      id: doc.id,
      title: doc.title,
      employeeId: doc.employee_id,
      forLabel,
      employeeEmail: employee?.email ?? null,
      ownerType,
      documentTypeName: docType?.name ?? '—',
      documentCategoryName: category?.name ?? null,
      issueDate: doc.issue_date,
      expiryDate: doc.expiry_date,
      uploadedAt: ver?.uploaded_at ?? null,
      fileUrl: ver?.file_url ?? null,
      storageObjectPath: ver?.storage_object_path ?? null,
      fileName: ver?.file_name ?? null,
      versionId: ver?.id ?? null,
    }
  })
}
