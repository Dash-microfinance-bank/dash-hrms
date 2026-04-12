'use client'

import React, { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  CreditCardIcon,
  DownloadIcon,
  EyeIcon,
  FileTextIcon,
  GraduationCapIcon,
  Loader2Icon,
  PhoneIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ProfileSchema } from '@/lib/data/employee-permissions'
import type {
  EducationRecord,
  EmployeeCollectionsForEss,
  ExperienceRecord,
  NextOfKinRecord,
  PendingRecordCreate,
  PersonRecord,
  TrainingRecord,
} from '@/lib/data/employee-profile'
import {
  createProfileUpdateRequestFromEss,
  type RecordCreateRequest,
  type RecordCreateTable,
} from '@/lib/actions/profile-update-requests'

type TabId = 'personal' | 'contact' | 'finance' | 'documents' | 'relations' | 'career'

type TabConfig = {
  id: TabId
  label: string
  Icon: React.ComponentType<{ className?: string }>
}

const TABS: TabConfig[] = [
  { id: 'personal', label: 'Personal', Icon: UserIcon },
  { id: 'contact', label: 'Contact', Icon: PhoneIcon },
  { id: 'finance', label: 'Finance', Icon: CreditCardIcon },
  { id: 'documents', label: 'Documents', Icon: FileTextIcon },
  { id: 'relations', label: 'Relations', Icon: UsersIcon },
  { id: 'career', label: 'Career', Icon: GraduationCapIcon },
]

type EmployeeDocumentMock = {
  id: string
  documentType: string
  title: string
  filename: string
  format: 'PDF' | 'DOCX' | 'PNG' | 'JPEG' | 'JPG'
  uploadedAt: string
  size: string
  issueDate?: string
  expiryDate?: string
}

const PROFILE_REQUIRED_DOCUMENT_TYPES = ['Passport', 'Offer Letter', 'Guarantor Form'] as const

const PROFILE_MOCK_DOCUMENTS: EmployeeDocumentMock[] = [
  {
    id: 'ess-doc-1',
    documentType: 'Passport',
    title: 'International Passport',
    filename: 'employee_passport.jpg',
    format: 'JPG',
    uploadedAt: 'Mar 10, 2026',
    size: '1.8 MB',
    issueDate: '2024-05-01',
    expiryDate: '2034-05-01',
  },
  {
    id: 'ess-doc-2',
    documentType: 'Offer Letter',
    title: 'Employment Offer Letter',
    filename: 'offer_letter.pdf',
    format: 'PDF',
    uploadedAt: 'Feb 28, 2026',
    size: '620 KB',
  },
]

function DocumentsMockTab() {
  const [docs, setDocs] = useState<EmployeeDocumentMock[]>(PROFILE_MOCK_DOCUMENTS)
  const [activeUploadType, setActiveUploadType] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')

  const previewUrl = useMemo(() => {
    if (!selectedFile || !selectedFile.type.startsWith('image/')) return null
    return URL.createObjectURL(selectedFile)
  }, [selectedFile])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const resetUploadForm = () => {
    setSelectedFile(null)
    setTitle('')
    setIssueDate('')
    setExpiryDate('')
  }

  const openUploadForm = (type: string) => {
    setActiveUploadType(type)
    resetUploadForm()
  }

  const closeUploadForm = () => {
    setActiveUploadType(null)
    resetUploadForm()
  }

  const announce = (action: string, doc: EmployeeDocumentMock) => {
    toast.info(`${action}: ${doc.filename}`)
  }

  const toSizeLabel = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const toFormat = (fileName: string): EmployeeDocumentMock['format'] => {
    const ext = fileName.split('.').pop()?.toUpperCase() ?? ''
    if (ext === 'PDF') return 'PDF'
    if (ext === 'DOCX') return 'DOCX'
    if (ext === 'PNG') return 'PNG'
    if (ext === 'JPG') return 'JPG'
    if (ext === 'JPEG') return 'JPEG'
    return 'PDF'
  }

  const byType = (() => {
    const map = new Map<
      string,
      { type: string; required: boolean; items: EmployeeDocumentMock[] }
    >()
    for (const t of PROFILE_REQUIRED_DOCUMENT_TYPES) {
      map.set(t, { type: t, required: true, items: [] })
    }
    for (const d of docs) {
      const current = map.get(d.documentType)
      if (current) current.items.push(d)
      else map.set(d.documentType, { type: d.documentType, required: false, items: [d] })
    }
    return Array.from(map.values())
  })()

  const handleAddFile = (type: string) => {
    if (!selectedFile) return toast.error('Please select a file')
    if (!title.trim()) return toast.error('Please enter a title')

    const newDoc: EmployeeDocumentMock = {
      id: `ess-doc-${Date.now()}`,
      documentType: type,
      title: title.trim(),
      filename: selectedFile.name,
      format: toFormat(selectedFile.name),
      uploadedAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      size: toSizeLabel(selectedFile.size),
      issueDate: issueDate || undefined,
      expiryDate: expiryDate || undefined,
    }

    setDocs((prev) => [newDoc, ...prev])
    toast.success(`Added ${newDoc.filename} to ${type} (mock)`)
    closeUploadForm()
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/20 px-3 py-2">
        <p className="text-sm font-medium">Employee Documents</p>
        <p className="text-xs text-muted-foreground">
          Supported formats: PDF, DOCX, PNG, JPEG, JPG
        </p>
      </div>

      {byType.map(({ type, items, required }) => (
        <div key={type} className="rounded-lg border bg-card">
          <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{type}</p>
                {required ? (
                  <span className="rounded-full border border-amber-400/50 bg-amber-100/50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    Required
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {items.length} file{items.length === 1 ? '' : 's'}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => openUploadForm(type)}>
              <UploadIcon className="mr-1.5 size-4" />
              Upload
            </Button>
          </div>

          <div className="border-t p-3 sm:p-4 space-y-2">
            {activeUploadType === type ? (
              <div className="rounded-md border bg-muted/20 p-3 space-y-3">
                <p className="text-sm font-medium">Add file to {type}</p>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor={`ess-doc-file-${type}`}>
                    File
                  </label>
                  <input
                    id={`ess-doc-file-${type}`}
                    type="file"
                    accept=".pdf,.docx,.png,.jpeg,.jpg"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
                  />
                </div>

                {selectedFile ? (
                  <div className="rounded-md border bg-background p-2" aria-label="Selected file preview">
                    {previewUrl ? (
                      <div className="space-y-2">
                        <img
                          src={previewUrl}
                          alt={`Preview of ${selectedFile.name}`}
                          className="max-h-40 w-auto rounded border object-contain"
                        />
                        <p className="text-xs text-muted-foreground truncate">{selectedFile.name}</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <FileTextIcon className="size-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground truncate">{selectedFile.name}</p>
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1 sm:col-span-3">
                    <label className="text-xs text-muted-foreground" htmlFor={`ess-doc-title-${type}`}>
                      Title
                    </label>
                    <input
                      id={`ess-doc-title-${type}`}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Valid Passport Bio Page"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground" htmlFor={`ess-doc-issue-${type}`}>
                      Issue date (optional)
                    </label>
                    <input
                      id={`ess-doc-issue-${type}`}
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground" htmlFor={`ess-doc-expiry-${type}`}>
                      Expiry date (optional)
                    </label>
                    <input
                      id={`ess-doc-expiry-${type}`}
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={closeUploadForm}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={() => handleAddFile(type)}>
                    Add file
                  </Button>
                </div>
              </div>
            ) : null}

            {items.length === 0 && required ? (
              <div className="rounded-md border border-dashed bg-muted/10 p-4 text-center">
                <p className="text-sm font-medium">No file uploaded yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This required document type needs at least one uploaded file.
                </p>
              </div>
            ) : null}

            {items.map((doc) => (
              <div key={doc.id} className="rounded-md border bg-muted/10 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                        {doc.format}
                      </span> */}
                      <span className="text-xs text-muted-foreground">
                        Uploaded {doc.uploadedAt} • {doc.size}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">{doc.title}</span>
                      {/* <button
                        type="button"
                        onClick={() => announce('Previewing document', doc)}
                        className="w-fit text-left text-sm text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                        aria-label={`Preview ${doc.filename}`}
                      >
                        File preview
                      </button> */}
                      <button
                        type="button"
                        onClick={() => announce('Opening file', doc)}
                        className="block max-w-full truncate text-left text-sm text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                        aria-label={`Open uploaded filename ${doc.filename}`}
                        title={doc.filename}
                      >
                        {doc.filename}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => announce('Viewing document', doc)}>
                      <EyeIcon className="mr-1.5 size-4" />
                      View
                    </Button>
                    <Button type="button" variant="destructive" size="sm" onClick={() => announce('Deleting document', doc)}>
                      <Trash2Icon className="mr-1.5 size-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const PERSONAL_SECTIONS = [
  {
    id: 'identity',
    title: 'Identity',
    fieldKeys: [
      'employee_biodata.title',
      'employee_biodata.firstname',
      'employee_biodata.lastname',
      'employee_biodata.othernames',
      'employee_biodata.gender',
      'employee_biodata.date_of_birth',
    ],
  },
  {
    id: 'origin',
    title: 'Origin',
    fieldKeys: [
      'employee_biodata.place_of_birth',
      'employee_biodata.lga',
      'employee_biodata.state',
      'employee_biodata.country',
    ],
  },
  {
    id: 'family_background',
    title: 'Family background',
    fieldKeys: [
      'employee_biodata.marital_status',
      'employee_biodata.religion',
      'employee_biodata.mothers_maiden_name',
      'employee_biodata.ethnic_group',
      'employee_biodata.spouse',
      'employee_biodata.spouse_phone',
      'employee_biodata.number_of_kids',
    ],
  },
  {
    id: 'health',
    title: 'Health',
    fieldKeys: [
      'employee_biodata.blood_group',
      'employee_biodata.genotype',
      'employee_biodata.allergies',
      'employee_biodata.medical_history',
    ],
  },
] as const

const CONTACT_SECTIONS = [
  {
    id: 'contact_details',
    title: 'Contact details',
    fieldKeys: [
      'employees.email',
      'employees.phone',
      'employee_biodata.alternate_phone',
      'employee_biodata.alternate_email',
    ],
  },
  {
    id: 'residential_address_contact',
    title: 'Residential address',
    fieldKeys: [
      'employee_address.residential_address',
      'employee_address.nearest_bus_stop',
      'employee_address.nearest_landmark',
      'employee_address.city',
      'employee_address.state',
      'employee_address.country',
    ],
  },
] as const

const FINANCE_SECTIONS = [
  {
    id: 'bank_finance',
    title: 'Bank & Finance',
    fieldKeys: [
      'employee_bank_details.bank_name',
      'employee_bank_details.account_name',
      'employee_bank_details.account_number',
      'employee_bank_details.account_type',
      'employee_bank_details.bvn',
      'employee_bank_details.nin',
      'employee_bank_details.pfa',
      'employee_bank_details.rsa_pin',
      'employee_bank_details.tax_id',
      'employee_bank_details.nhf_id',
    ],
  },
] as const

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
]

const NIGERIA_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT (Abuja)', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
  'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara',
]

const NIGERIA_COUNTRY_OPTIONS = [{ value: 'Nigeria', label: 'Nigeria' }]

const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((v) => ({
  value: v,
  label: v,
}))

const GENOTYPE_OPTIONS = ['AA', 'AS', 'SS', 'AC'].map((v) => ({ value: v, label: v }))

const RELIGION_OPTIONS = ['Christianity', 'Islam', 'Traditional', 'Other'].map((v) => ({
  value: v,
  label: v,
}))

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'savings', label: 'Savings' },
  { value: 'current', label: 'Current' },
]

const SELECT_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  'employee_biodata.gender': GENDER_OPTIONS,
  'employee_biodata.marital_status': MARITAL_STATUS_OPTIONS,
  'employee_biodata.blood_group': BLOOD_GROUP_OPTIONS,
  'employee_biodata.genotype': GENOTYPE_OPTIONS,
  'employee_biodata.religion': RELIGION_OPTIONS,
  'employee_biodata.state': NIGERIA_STATES.map((s) => ({ value: s, label: s })),
  'employee_biodata.country': NIGERIA_COUNTRY_OPTIONS,
  'employee_address.state': NIGERIA_STATES.map((s) => ({ value: s, label: s })),
  'employee_address.country': NIGERIA_COUNTRY_OPTIONS,
  'employee_bank_details.account_type': ACCOUNT_TYPE_OPTIONS,
}

const DATE_FIELDS = new Set(['employee_biodata.date_of_birth'])
const NUMBER_FIELDS = new Set(['employee_biodata.number_of_kids'])

// Per-field customizable placeholders, keyed by field_key.
// Falls back to the field label when not specified.
const PLACEHOLDERS: Record<string, string> = {
  // Personal – identity
  'employee_biodata.title': 'Mr / Mrs / Dr',
  'employee_biodata.firstname': 'Input your first name',
  'employee_biodata.lastname': 'Input your last name',
  'employee_biodata.othernames': 'Input your last name',
  'employee_biodata.gender': 'Select gender',
  'employee_biodata.date_of_birth': 'Select date of birth',

  // Personal – origin
  'employee_biodata.place_of_birth': 'City / town of birth',
  'employee_biodata.lga': 'Local government area',
  'employee_biodata.state': 'Select state of origin',
  'employee_biodata.country': 'Country of origin',

  // Personal – family background
  'employee_biodata.marital_status': 'Select marital status',
  'employee_biodata.religion': 'Select religion',
  'employee_biodata.mothers_maiden_name': "Mother's maiden name",
  'employee_biodata.ethnic_group': 'Ethnic group',
  'employee_biodata.spouse': "Spouse's name",
  'employee_biodata.spouse_phone': "Spouse's phone number",
  'employee_biodata.number_of_kids': 'Number of children',

  // Personal – health
  'employee_biodata.blood_group': 'Select blood group',
  'employee_biodata.genotype': 'Select genotype',
  'employee_biodata.allergies': 'List any allergies',
  'employee_biodata.medical_history': 'Brief medical history / conditions',

  // Contact – contact details
  'employees.email': 'Add company email address',
  'employees.phone': 'Add primary phone number',
  'employee_biodata.alternate_phone': 'Add alternate phone number',
  'employee_biodata.alternate_email': 'Add alternate email address',

  // Contact / Finance – residential address
  'employee_address.residential_address': 'Street address',
  'employee_address.nearest_bus_stop': 'Nearest bus stop',
  'employee_address.nearest_landmark': 'Nearest landmark',
  'employee_address.city': 'City',
  'employee_address.state': 'State / region',
  'employee_address.country': 'Country',

  // Finance – bank & finance
  'employee_bank_details.bank_name': 'Bank name',
  'employee_bank_details.account_name': 'Account name',
  'employee_bank_details.account_number': '10-digit account number',
  'employee_bank_details.account_type': 'Select account type',
  'employee_bank_details.bvn': '11-digit BVN (optional)',
  'employee_bank_details.nin': '11-digit NIN (optional)',
  'employee_bank_details.pfa': 'Pension Fund Administrator (PFA)',
  'employee_bank_details.rsa_pin': 'Retirement Savings Account (RSA) PIN',
  'employee_bank_details.tax_id': 'Tax Identification Number (TIN)',
  'employee_bank_details.nhf_id': 'NHF ID (optional)',
}

const INPUT_BASE =
  'h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm w-full focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'

const SELECT_BASE =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'

const NEXT_OF_KIN_PURPOSE_OPTIONS = [
  { value: 'Benefit', label: 'Benefit' },
  { value: 'Emergency', label: 'Emergency' },
  { value: 'Benefit and Emergency', label: 'Benefit and Emergency' },
] as const

type FieldDef = {
  field_key: string
  label: string
  can_read: boolean
  can_write: boolean
}

type DraftRecord = RecordCreateRequest & { clientId: string }

interface ProfileUpdateRequestFormProps {
  schema: ProfileSchema
  initialValues: Record<string, unknown>
  pendingFields: string[]
  collections: EmployeeCollectionsForEss
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

function initializeFormValues(initialValues: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(initialValues)) out[k] = toStr(v)
  // Default all country fields to Nigeria when empty
  const countryKeys = ['employee_biodata.country', 'employee_address.country']
  for (const key of countryKeys) {
    if (!out[key] || out[key].trim() === '') {
      out[key] = 'Nigeria'
    }
  }
  return out
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return d
  }
}

function FL({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted-foreground">{children}</label>
}

function FieldItem({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium leading-snug">{value && value !== '' ? value : '—'}</p>
    </div>
  )
}

function PendingRequestBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
      Pending approval from HR
    </span>
  )
}

function DraftBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
      Ready to submit
    </span>
  )
}

function SectionHeader({
  title,
  onAdd,
}: {
  title: string
  onAdd: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold">{title}</h3>
      <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={onAdd}>
        <PlusIcon className="size-3" /> Add
      </Button>
    </div>
  )
}

function PendingCreateSummary({
  pendingRecords,
}: {
  pendingRecords: PendingRecordCreate[]
}) {
  if (pendingRecords.length === 0) return null
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50/50 px-3 py-2 text-xs text-amber-800">
      {pendingRecords.length} pending {pendingRecords.length === 1 ? 'record request' : 'record requests'} awaiting HR approval.
    </div>
  )
}

function buildFieldMap(schema: ProfileSchema) {
  const map = new Map<string, FieldDef>()
  for (const fields of Object.values(schema)) {
    for (const field of fields) map.set(field.field_key, field)
  }
  return map
}

function renderScalarInput(args: {
  field: FieldDef
  formValues: Record<string, string>
  initialValues: Record<string, unknown>
  pendingSet: Set<string>
  onChange: (fieldKey: string, value: string) => void
}) {
  const { field, formValues, initialValues, pendingSet, onChange } = args
  const fieldKey = field.field_key
  const isFieldPending = pendingSet.has(fieldKey)
  const isWritable = field.can_write && !isFieldPending
  const currentValue = formValues[fieldKey] ?? ''
  const originalValue = toStr(initialValues[fieldKey])
  const isDirty = isWritable && currentValue !== originalValue
  const selectOpts = SELECT_OPTIONS[fieldKey]
  const isDate = DATE_FIELDS.has(fieldKey)
  const isNumber = NUMBER_FIELDS.has(fieldKey)
  const placeholder = PLACEHOLDERS[fieldKey] ?? field.label

  return (
    <div key={fieldKey} className="space-y-1">
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
        {isDirty ? (
          <span className="text-[9px] font-semibold uppercase tracking-wide text-primary">changed</span>
        ) : null}
      </div>

      {selectOpts ? (
        <select
          value={currentValue}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          disabled={!isWritable}
          aria-label={field.label}
          className={cn(
            SELECT_BASE,
            'disabled:cursor-not-allowed disabled:bg-muted/30 disabled:opacity-60',
            isFieldPending && 'border-amber-300 bg-amber-50/40',
            isDirty && !isFieldPending && 'border-primary/50'
          )}
        >
          <option value="">Select…</option>
          {selectOpts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <Input
          type={isDate ? 'date' : isNumber ? 'number' : 'text'}
          value={currentValue}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          disabled={!isWritable}
          aria-label={field.label}
          placeholder={isDate ? (placeholder || 'Select date') : placeholder}
          className={cn(
            INPUT_BASE,
            'disabled:cursor-not-allowed disabled:bg-muted/30 disabled:opacity-60',
            isFieldPending && 'border-amber-300 bg-amber-50/40',
            isDirty && !isFieldPending && 'border-primary/50'
          )}
        />
      )}

      {isFieldPending ? (
        <p className="text-[11px] font-medium text-amber-600">Pending approval from HR</p>
      ) : null}
    </div>
  )
}

function ScalarSectionCard({
  title,
  fieldKeys,
  fieldByKey,
  formValues,
  initialValues,
  pendingSet,
  onChange,
}: {
  title: string
  fieldKeys: readonly string[]
  fieldByKey: Map<string, FieldDef>
  formValues: Record<string, string>
  initialValues: Record<string, unknown>
  pendingSet: Set<string>
  onChange: (fieldKey: string, value: string) => void
}) {
  const visibleFields = fieldKeys
    .map((key) => fieldByKey.get(key))
    .filter((field): field is FieldDef => !!field?.can_read)

  if (visibleFields.length === 0) return null

  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        {visibleFields.map((field) =>
          renderScalarInput({
            field,
            formValues,
            initialValues,
            pendingSet,
            onChange,
          })
        )}
      </div>
    </div>
  )
}

const personSchema = z.object({
  title: z.string().max(20, 'Too long'),
  first_name: z.string().min(1, 'First name is required').max(100, 'Too long'),
  last_name: z.string().min(1, 'Last name is required').max(100, 'Too long'),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .refine((v) => /^\+?[\d\s\-(). ]{7,20}$/.test(v), { message: 'Invalid phone number' }),
  email: z.string().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
    message: 'Invalid email address',
  }),
  relationship: z.string().min(1, 'Relationship is required').max(100, 'Too long'),
  address: z.string().min(1, 'Address is required').max(255, 'Too long'),
})

type PersonForm = z.infer<typeof personSchema>

const nextOfKinSchema = personSchema.extend({
  purpose: z
    .string()
    .min(1, 'Purpose is required')
    .refine((v) => ['Benefit', 'Emergency', 'Benefit and Emergency'].includes(v), {
      message: 'Please select Benefit, Emergency, or Benefit and Emergency',
    }),
})

type NextOfKinForm = z.infer<typeof nextOfKinSchema>

const experienceSchema = z
  .object({
    company: z.string().min(1, 'Company is required').max(150, 'Too long'),
    position: z.string().min(1, 'Position / title is required').max(150, 'Too long'),
    phone: z.string().refine((v) => !v || /^\+?[\d\s\-(). ]{7,20}$/.test(v), {
      message: 'Invalid phone number',
    }),
    email: z.string().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: 'Invalid email address',
    }),
    address: z.string().min(1, 'Company address is required').max(255, 'Too long'),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string(),
    reason_for_leaving: z.string().max(255, 'Too long'),
  })
  .refine((d) => !d.end_date || new Date(d.end_date) >= new Date(d.start_date), {
    message: 'End date must not be before start date',
    path: ['end_date'],
  })

type ExperienceForm = z.infer<typeof experienceSchema>

const educationSchema = z
  .object({
    school: z.string().min(1, 'School / institution is required').max(150, 'Too long'),
    course: z.string().min(1, 'Course / field of study is required').max(150, 'Too long'),
    degree: z.string().min(1, 'Degree / qualification is required').max(100, 'Too long'),
    grade: z.string().max(50, 'Too long'),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string(),
  })
  .refine((d) => !d.end_date || new Date(d.end_date) >= new Date(d.start_date), {
    message: 'End date must not be before start date',
    path: ['end_date'],
  })

type EducationForm = z.infer<typeof educationSchema>

const trainingSchema = z
  .object({
    institution: z.string().min(1, 'Institution is required').max(150, 'Too long'),
    course: z.string().min(1, 'Course / training is required').max(150, 'Too long'),
    license_name: z.string().max(150, 'Too long'),
    issuing_body: z.string().max(150, 'Too long'),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string(),
  })
  .refine((d) => !d.end_date || new Date(d.end_date) >= new Date(d.start_date), {
    message: 'End date must not be before start date',
    path: ['end_date'],
  })

type TrainingForm = z.infer<typeof trainingSchema>

function PersonCard({
  title,
  first_name,
  last_name,
  phone,
  email,
  relationship,
  address,
  badge,
  onRemove,
}: {
  title?: string | null
  first_name: string
  last_name: string
  phone: string
  email?: string | null
  relationship: string
  address: string
  badge?: React.ReactNode
  onRemove?: () => void
}) {
  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {title ? `${title} ` : ''}
            {first_name} {last_name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{relationship}</p>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {onRemove ? (
            <Button variant="ghost" size="icon" className="size-7" onClick={onRemove}>
              <Trash2Icon className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 border-t pt-1 sm:grid-cols-2">
        <FieldItem label="Phone" value={phone} />
        <FieldItem label="Email" value={email ?? null} />
        <FieldItem label="Relationship" value={relationship} />
        <FieldItem label="Address" value={address} />
      </div>
    </div>
  )
}

function NextOfKinCard({
  rec,
  badge,
  onRemove,
}: {
  rec: NextOfKinForm | NextOfKinRecord
  badge?: React.ReactNode
  onRemove?: () => void
}) {
  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {rec.title ? `${rec.title} ` : ''}
            {rec.first_name} {rec.last_name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{rec.relationship}</p>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {onRemove ? (
            <Button variant="ghost" size="icon" className="size-7" onClick={onRemove}>
              <Trash2Icon className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 border-t pt-1 sm:grid-cols-2">
        <FieldItem label="Phone" value={rec.phone} />
        <FieldItem label="Email" value={rec.email ?? null} />
        <FieldItem label="Purpose" value={rec.purpose} />
        <FieldItem label="Address" value={rec.address} />
      </div>
    </div>
  )
}

function ExperienceCard({
  rec,
  badge,
  onRemove,
}: {
  rec: ExperienceForm | ExperienceRecord
  badge?: React.ReactNode
  onRemove?: () => void
}) {
  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{rec.company}</p>
          <p className="truncate text-xs text-muted-foreground">{rec.position}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {fmtDate(rec.start_date)} - {rec.end_date ? fmtDate(rec.end_date) : 'Present'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {onRemove ? (
            <Button variant="ghost" size="icon" className="size-7" onClick={onRemove}>
              <Trash2Icon className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 border-t pt-1 sm:grid-cols-2">
        <FieldItem label="Company phone" value={rec.phone ?? null} />
        <FieldItem label="Company email" value={rec.email ?? null} />
        <FieldItem label="Company address" value={rec.address} />
        <FieldItem label="Reason for leaving" value={rec.reason_for_leaving ?? null} />
      </div>
    </div>
  )
}

function EducationCard({
  rec,
  badge,
  onRemove,
}: {
  rec: EducationForm | EducationRecord
  badge?: React.ReactNode
  onRemove?: () => void
}) {
  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{rec.school}</p>
          <p className="truncate text-xs text-muted-foreground">
            {rec.degree}
            {rec.course ? ` · ${rec.course}` : ''}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {fmtDate(rec.start_date)} - {rec.end_date ? fmtDate(rec.end_date) : 'Present'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {onRemove ? (
            <Button variant="ghost" size="icon" className="size-7" onClick={onRemove}>
              <Trash2Icon className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>
      {rec.grade ? (
        <div className="border-t pt-1">
          <FieldItem label="Grade / Class" value={rec.grade} />
        </div>
      ) : null}
    </div>
  )
}

function TrainingCard({
  rec,
  badge,
  onRemove,
}: {
  rec: TrainingForm | TrainingRecord
  badge?: React.ReactNode
  onRemove?: () => void
}) {
  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{rec.course}</p>
          <p className="truncate text-xs text-muted-foreground">{rec.institution}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {fmtDate(rec.start_date)} - {rec.end_date ? fmtDate(rec.end_date) : 'No expiry'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {onRemove ? (
            <Button variant="ghost" size="icon" className="size-7" onClick={onRemove}>
              <Trash2Icon className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>
      {rec.license_name || rec.issuing_body ? (
        <div className="grid grid-cols-1 gap-2 border-t pt-1 sm:grid-cols-2">
          <FieldItem label="Licence / Certificate" value={rec.license_name ?? null} />
          <FieldItem label="Issuing body" value={rec.issuing_body ?? null} />
        </div>
      ) : null}
    </div>
  )
}

function PersonCreateSection({
  title,
  table,
  records,
  pendingRecords,
  draftRecords,
  onAddDraft,
  onRemoveDraft,
}: {
  title: string
  table: 'employee_family' | 'employee_dependants'
  records: PersonRecord[]
  pendingRecords: PendingRecordCreate[]
  draftRecords: DraftRecord[]
  onAddDraft: (record: RecordCreateRequest) => void
  onRemoveDraft: (clientId: string) => void
}) {
  const empty: PersonForm = {
    title: '',
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    relationship: '',
    address: '',
  }
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<PersonForm>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof PersonForm, string>>>({})

  const s = (k: keyof PersonForm) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setErrors((p) => ({ ...p, [k]: undefined }))
  }

  const handleSave = () => {
    const result = personSchema.safeParse(form)
    if (!result.success) {
      const nextErrors: Partial<Record<keyof PersonForm, string>> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof PersonForm
        if (!nextErrors[key]) nextErrors[key] = issue.message
      }
      setErrors(nextErrors)
      return
    }
    onAddDraft({ table, payload: result.data })
    setForm(empty)
    setErrors({})
    setAdding(false)
    toast.success(`${title} queued for HR approval`)
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <SectionHeader title={title} onAdd={() => { setForm(empty); setErrors({}); setAdding(true) }} />
      <PendingCreateSummary pendingRecords={pendingRecords} />

      {adding ? (
        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1"><FL>Title</FL><Input value={form.title} onChange={(e) => s('title')(e.target.value)} className={INPUT_BASE} placeholder="Mr / Mrs / Dr" /></div>
            <div className="space-y-1"><FL>First name</FL><Input value={form.first_name} onChange={(e) => s('first_name')(e.target.value)} className={cn(INPUT_BASE, errors.first_name && 'border-destructive')} placeholder="Add first name" />{errors.first_name ? <p className="ml-1 text-xs text-destructive">{errors.first_name}</p> : null}</div>
            <div className="space-y-1"><FL>Last name</FL><Input value={form.last_name} onChange={(e) => s('last_name')(e.target.value)} className={cn(INPUT_BASE, errors.last_name && 'border-destructive')} placeholder="Add last name" />{errors.last_name ? <p className="ml-1 text-xs text-destructive">{errors.last_name}</p> : null}</div>
            <div className="space-y-1"><FL>Phone</FL><Input value={form.phone} onChange={(e) => s('phone')(e.target.value)} className={cn(INPUT_BASE, errors.phone && 'border-destructive')} placeholder="Add phone number" />{errors.phone ? <p className="ml-1 text-xs text-destructive">{errors.phone}</p> : null}</div>
            <div className="space-y-1"><FL>Email</FL><Input value={form.email} onChange={(e) => s('email')(e.target.value)} className={cn(INPUT_BASE, errors.email && 'border-destructive')} placeholder='Add email address' />{errors.email ? <p className="ml-1 text-xs text-destructive">{errors.email}</p> : null}</div>
            <div className="space-y-1"><FL>Relationship</FL><Input value={form.relationship} onChange={(e) => s('relationship')(e.target.value)} className={cn(INPUT_BASE, errors.relationship && 'border-destructive')} placeholder="Your relationship with this person?" />{errors.relationship ? <p className="ml-1 text-xs text-destructive">{errors.relationship}</p> : null}</div>
            <div className="space-y-1 sm:col-span-2"><FL>Address</FL><Input value={form.address} onChange={(e) => s('address')(e.target.value)} className={cn(INPUT_BASE, errors.address && 'border-destructive')} placeholder="Add person's residential address" />{errors.address ? <p className="ml-1 text-xs text-destructive">{errors.address}</p> : null}</div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)} className="h-7 px-2 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleSave} className="h-7 px-2 text-xs gap-1"><PlusIcon className="size-3" /> Add Person</Button>
          </div>
        </div>
      ) : null}

      {records.length === 0 && pendingRecords.length === 0 && draftRecords.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground">No records yet.</p>
      ) : null}

      {records.map((rec) => (
        <PersonCard key={rec.id} {...rec} />
      ))}
      {pendingRecords.map((rec) => (
        <PersonCard key={rec.id} {...(rec.payload as PersonForm)} badge={<PendingRequestBadge />} />
      ))}
      {draftRecords.map((rec) => (
        <PersonCard key={rec.clientId} {...(rec.payload as PersonForm)} badge={<DraftBadge />} onRemove={() => onRemoveDraft(rec.clientId)} />
      ))}
    </div>
  )
}

function NextOfKinCreateSection({
  records,
  pendingRecords,
  draftRecords,
  onAddDraft,
  onRemoveDraft,
}: {
  records: NextOfKinRecord[]
  pendingRecords: PendingRecordCreate[]
  draftRecords: DraftRecord[]
  onAddDraft: (record: RecordCreateRequest) => void
  onRemoveDraft: (clientId: string) => void
}) {
  const empty: NextOfKinForm = {
    title: '',
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    relationship: '',
    purpose: '',
    address: '',
  }
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<NextOfKinForm>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof NextOfKinForm, string>>>({})

  const s = (k: keyof NextOfKinForm) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setErrors((p) => ({ ...p, [k]: undefined }))
  }

  const handleSave = () => {
    const result = nextOfKinSchema.safeParse(form)
    if (!result.success) {
      const nextErrors: Partial<Record<keyof NextOfKinForm, string>> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof NextOfKinForm
        if (!nextErrors[key]) nextErrors[key] = issue.message
      }
      setErrors(nextErrors)
      return
    }
    onAddDraft({ table: 'employee_next_of_kin', payload: result.data })
    setForm(empty)
    setErrors({})
    setAdding(false)
    toast.success('Next of kin record queued for HR approval')
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <SectionHeader title="Next of kin records" onAdd={() => { setForm(empty); setErrors({}); setAdding(true) }} />
      <PendingCreateSummary pendingRecords={pendingRecords} />

      {adding ? (
        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1"><FL>Title</FL><Input value={form.title} onChange={(e) => s('title')(e.target.value)} className={INPUT_BASE} placeholder="Mr / Mrs / Dr" /></div>
            <div className="space-y-1"><FL>First name</FL><Input value={form.first_name} onChange={(e) => s('first_name')(e.target.value)} className={cn(INPUT_BASE, errors.first_name && 'border-destructive')} placeholder="Add first name" />{errors.first_name ? <p className="ml-1 text-xs text-destructive">{errors.first_name}</p> : null}</div>
            <div className="space-y-1"><FL>Last name</FL><Input value={form.last_name} onChange={(e) => s('last_name')(e.target.value)} className={cn(INPUT_BASE, errors.last_name && 'border-destructive')} placeholder="Add last name" />{errors.last_name ? <p className="ml-1 text-xs text-destructive">{errors.last_name}</p> : null}</div>
            <div className="space-y-1"><FL>Email</FL><Input value={form.email} onChange={(e) => s('email')(e.target.value)} className={cn(INPUT_BASE, errors.email && 'border-destructive')} placeholder="Add email address" />{errors.email ? <p className="ml-1 text-xs text-destructive">{errors.email}</p> : null}</div>
            <div className="space-y-1"><FL>Phone</FL><Input value={form.phone} onChange={(e) => s('phone')(e.target.value)} className={cn(INPUT_BASE, errors.phone && 'border-destructive')} placeholder="Add phone number" />{errors.phone ? <p className="ml-1 text-xs text-destructive">{errors.phone}</p> : null}</div>
            <div className="space-y-1"><FL>Relationship</FL><Input value={form.relationship} onChange={(e) => s('relationship')(e.target.value)} className={cn(INPUT_BASE, errors.relationship && 'border-destructive')} placeholder="Your relationship with this person?" />{errors.relationship ? <p className="ml-1 text-xs text-destructive">{errors.relationship}</p> : null}</div>
            <div className="space-y-1">
              <FL>Purpose</FL>
              <select
                value={form.purpose}
                onChange={(e) => s('purpose')(e.target.value)}
                aria-label="Purpose"
                className={cn(SELECT_BASE, errors.purpose && 'border-destructive')}
              >
                <option value="">Select…</option>
                {NEXT_OF_KIN_PURPOSE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {errors.purpose ? <p className="ml-1 text-xs text-destructive">{errors.purpose}</p> : null}
            </div>
            <div className="space-y-1 sm:col-span-2"><FL>Address</FL><Input value={form.address} onChange={(e) => s('address')(e.target.value)} className={cn(INPUT_BASE, errors.address && 'border-destructive')} placeholder="Add house address of next of kin" />{errors.address ? <p className="ml-1 text-xs text-destructive">{errors.address}</p> : null}</div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)} className="h-7 px-2 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleSave} className="h-7 px-2 text-xs gap-1"><PlusIcon className="size-3" /> Queue record</Button>
          </div>
        </div>
      ) : null}

      {records.length === 0 && pendingRecords.length === 0 && draftRecords.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground">No records yet.</p>
      ) : null}

      {records.map((rec) => (
        <NextOfKinCard key={rec.id} rec={rec} />
      ))}
      {pendingRecords.map((rec) => (
        <NextOfKinCard key={rec.id} rec={rec.payload as NextOfKinForm} badge={<PendingRequestBadge />} />
      ))}
      {draftRecords.map((rec) => (
        <NextOfKinCard key={rec.clientId} rec={rec.payload as NextOfKinForm} badge={<DraftBadge />} onRemove={() => onRemoveDraft(rec.clientId)} />
      ))}
    </div>
  )
}

function ExperienceCreateSection({
  records,
  pendingRecords,
  draftRecords,
  onAddDraft,
  onRemoveDraft,
}: {
  records: ExperienceRecord[]
  pendingRecords: PendingRecordCreate[]
  draftRecords: DraftRecord[]
  onAddDraft: (record: RecordCreateRequest) => void
  onRemoveDraft: (clientId: string) => void
}) {
  const empty: ExperienceForm = {
    company: '',
    position: '',
    phone: '',
    email: '',
    address: '',
    start_date: '',
    end_date: '',
    reason_for_leaving: '',
  }
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<ExperienceForm>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof ExperienceForm, string>>>({})

  const s = (k: keyof ExperienceForm) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setErrors((p) => ({ ...p, [k]: undefined }))
  }

  const handleSave = () => {
    const result = experienceSchema.safeParse(form)
    if (!result.success) {
      const nextErrors: Partial<Record<keyof ExperienceForm, string>> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof ExperienceForm
        if (!nextErrors[key]) nextErrors[key] = issue.message
      }
      setErrors(nextErrors)
      return
    }
    onAddDraft({ table: 'employee_experience', payload: result.data })
    setForm(empty)
    setErrors({})
    setAdding(false)
    toast.success('Work experience queued for HR approval')
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <SectionHeader title="Work experience records" onAdd={() => { setForm(empty); setErrors({}); setAdding(true) }} />
      <PendingCreateSummary pendingRecords={pendingRecords} />

      {adding ? (
        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1"><FL>Company</FL><Input value={form.company} onChange={(e) => s('company')(e.target.value)} className={cn(INPUT_BASE, errors.company && 'border-destructive')} placeholder='Add company name' />{errors.company ? <p className="ml-1 text-xs text-destructive">{errors.company}</p> : null}</div>
            <div className="space-y-1"><FL>Position / title</FL><Input value={form.position} onChange={(e) => s('position')(e.target.value)} className={cn(INPUT_BASE, errors.position && 'border-destructive')} placeholder='Add job title' />{errors.position ? <p className="ml-1 text-xs text-destructive">{errors.position}</p> : null}</div>
            <div className="space-y-1"><FL>Company phone</FL><Input value={form.phone} onChange={(e) => s('phone')(e.target.value)} className={cn(INPUT_BASE, errors.phone && 'border-destructive')} placeholder='Add company phone number' />{errors.phone ? <p className="ml-1 text-xs text-destructive">{errors.phone}</p> : null}</div>
            <div className="space-y-1"><FL>Company email</FL><Input value={form.email} onChange={(e) => s('email')(e.target.value)} className={cn(INPUT_BASE, errors.email && 'border-destructive')} placeholder='Add company email address' />{errors.email ? <p className="ml-1 text-xs text-destructive">{errors.email}</p> : null}</div>
            <div className="space-y-1 sm:col-span-2"><FL>Company address</FL><Input value={form.address} onChange={(e) => s('address')(e.target.value)} className={cn(INPUT_BASE, errors.address && 'border-destructive')} placeholder='Add company address' />{errors.address ? <p className="ml-1 text-xs text-destructive">{errors.address}</p> : null}</div>
            <div className="space-y-1"><FL>Start date</FL><Input type="date" value={form.start_date} onChange={(e) => s('start_date')(e.target.value)} className={cn(INPUT_BASE, errors.start_date && 'border-destructive')} placeholder='Select start date' />{errors.start_date ? <p className="ml-1 text-xs text-destructive">{errors.start_date}</p> : null}</div>
            <div className="space-y-1"><FL>End date</FL><Input type="date" value={form.end_date} onChange={(e) => s('end_date')(e.target.value)} className={cn(INPUT_BASE, errors.end_date && 'border-destructive')} placeholder='Select end date' />{errors.end_date ? <p className="ml-1 text-xs text-destructive">{errors.end_date}</p> : null}</div>
            <div className="space-y-1 sm:col-span-2"><FL>Reason for leaving</FL><Input value={form.reason_for_leaving} onChange={(e) => s('reason_for_leaving')(e.target.value)} className={cn(INPUT_BASE, errors.reason_for_leaving && 'border-destructive')} placeholder='Reason for leaving the company' />{errors.reason_for_leaving ? <p className="ml-1 text-xs text-destructive">{errors.reason_for_leaving}</p> : null}</div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)} className="h-7 px-2 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleSave} className="h-7 px-2 text-xs gap-1"><PlusIcon className="size-3" /> Add Experience</Button>
          </div>
        </div>
      ) : null}

      {records.length === 0 && pendingRecords.length === 0 && draftRecords.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground">No experience records yet.</p>
      ) : null}

      {records.map((rec) => (
        <ExperienceCard key={rec.id} rec={rec} />
      ))}
      {pendingRecords.map((rec) => (
        <ExperienceCard key={rec.id} rec={rec.payload as ExperienceForm} badge={<PendingRequestBadge />} />
      ))}
      {draftRecords.map((rec) => (
        <ExperienceCard key={rec.clientId} rec={rec.payload as ExperienceForm} badge={<DraftBadge />} onRemove={() => onRemoveDraft(rec.clientId)} />
      ))}
    </div>
  )
}

function EducationCreateSection({
  records,
  pendingRecords,
  draftRecords,
  onAddDraft,
  onRemoveDraft,
}: {
  records: EducationRecord[]
  pendingRecords: PendingRecordCreate[]
  draftRecords: DraftRecord[]
  onAddDraft: (record: RecordCreateRequest) => void
  onRemoveDraft: (clientId: string) => void
}) {
  const empty: EducationForm = {
    school: '',
    course: '',
    degree: '',
    grade: '',
    start_date: '',
    end_date: '',
  }
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<EducationForm>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof EducationForm, string>>>({})

  const s = (k: keyof EducationForm) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setErrors((p) => ({ ...p, [k]: undefined }))
  }

  const handleSave = () => {
    const result = educationSchema.safeParse(form)
    if (!result.success) {
      const nextErrors: Partial<Record<keyof EducationForm, string>> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof EducationForm
        if (!nextErrors[key]) nextErrors[key] = issue.message
      }
      setErrors(nextErrors)
      return
    }
    onAddDraft({ table: 'employee_education', payload: result.data })
    setForm(empty)
    setErrors({})
    setAdding(false)
    toast.success('Education record queued for HR approval')
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <SectionHeader title="Education records" onAdd={() => { setForm(empty); setErrors({}); setAdding(true) }} />
      <PendingCreateSummary pendingRecords={pendingRecords} />

      {adding ? (
        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1"><FL>School / institution</FL><Input value={form.school} onChange={(e) => s('school')(e.target.value)} className={cn(INPUT_BASE, errors.school && 'border-destructive')} placeholder='Add school name' />{errors.school ? <p className="ml-1 text-xs text-destructive">{errors.school}</p> : null}</div>
            <div className="space-y-1"><FL>Course / field of study</FL><Input value={form.course} onChange={(e) => s('course')(e.target.value)} className={cn(INPUT_BASE, errors.course && 'border-destructive')} placeholder='Add course name' />{errors.course ? <p className="ml-1 text-xs text-destructive">{errors.course}</p> : null}</div>
            <div className="space-y-1"><FL>Degree / qualification</FL><Input value={form.degree} onChange={(e) => s('degree')(e.target.value)} className={cn(INPUT_BASE, errors.degree && 'border-destructive')} placeholder='Add degree name' />{errors.degree ? <p className="ml-1 text-xs text-destructive">{errors.degree}</p> : null}</div>
            <div className="space-y-1"><FL>Grade / class</FL><Input value={form.grade} onChange={(e) => s('grade')(e.target.value)} className={cn(INPUT_BASE, errors.grade && 'border-destructive')} placeholder='Add grade' />{errors.grade ? <p className="ml-1 text-xs text-destructive">{errors.grade}</p> : null}</div>
            <div className="space-y-1"><FL>Start date</FL><Input type="date" value={form.start_date} onChange={(e) => s('start_date')(e.target.value)} className={cn(INPUT_BASE, errors.start_date && 'border-destructive')} placeholder='Select start date' />{errors.start_date ? <p className="ml-1 text-xs text-destructive">{errors.start_date}</p> : null}</div>
            <div className="space-y-1"><FL>End date</FL><Input type="date" value={form.end_date} onChange={(e) => s('end_date')(e.target.value)} className={cn(INPUT_BASE, errors.end_date && 'border-destructive')} placeholder='Select end date' />{errors.end_date ? <p className="ml-1 text-xs text-destructive">{errors.end_date}</p> : null}</div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)} className="h-7 px-2 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleSave} className="h-7 px-2 text-xs gap-1"><PlusIcon className="size-3" /> Add Education</Button>
          </div>
        </div>
      ) : null}

      {records.length === 0 && pendingRecords.length === 0 && draftRecords.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground">No education records yet.</p>
      ) : null}

      {records.map((rec) => (
        <EducationCard key={rec.id} rec={rec} />
      ))}
      {pendingRecords.map((rec) => (
        <EducationCard key={rec.id} rec={rec.payload as EducationForm} badge={<PendingRequestBadge />} />
      ))}
      {draftRecords.map((rec) => (
        <EducationCard key={rec.clientId} rec={rec.payload as EducationForm} badge={<DraftBadge />} onRemove={() => onRemoveDraft(rec.clientId)} />
      ))}
    </div>
  )
}

function TrainingCreateSection({
  records,
  pendingRecords,
  draftRecords,
  onAddDraft,
  onRemoveDraft,
}: {
  records: TrainingRecord[]
  pendingRecords: PendingRecordCreate[]
  draftRecords: DraftRecord[]
  onAddDraft: (record: RecordCreateRequest) => void
  onRemoveDraft: (clientId: string) => void
}) {
  const empty: TrainingForm = {
    institution: '',
    course: '',
    license_name: '',
    issuing_body: '',
    start_date: '',
    end_date: '',
  }
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<TrainingForm>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof TrainingForm, string>>>({})

  const s = (k: keyof TrainingForm) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setErrors((p) => ({ ...p, [k]: undefined }))
  }

  const handleSave = () => {
    const result = trainingSchema.safeParse(form)
    if (!result.success) {
      const nextErrors: Partial<Record<keyof TrainingForm, string>> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof TrainingForm
        if (!nextErrors[key]) nextErrors[key] = issue.message
      }
      setErrors(nextErrors)
      return
    }
    onAddDraft({ table: 'employee_training', payload: result.data })
    setForm(empty)
    setErrors({})
    setAdding(false)
    toast.success('Training record queued for HR approval')
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <SectionHeader title="Training and certificates" onAdd={() => { setForm(empty); setErrors({}); setAdding(true) }} />
      <PendingCreateSummary pendingRecords={pendingRecords} />

      {adding ? (
        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1"><FL>Institution</FL><Input value={form.institution} onChange={(e) => s('institution')(e.target.value)} className={cn(INPUT_BASE, errors.institution && 'border-destructive')} placeholder='Add training provider name' />{errors.institution ? <p className="ml-1 text-xs text-destructive">{errors.institution}</p> : null}</div>
            <div className="space-y-1"><FL>Course / training</FL><Input value={form.course} onChange={(e) => s('course')(e.target.value)} className={cn(INPUT_BASE, errors.course && 'border-destructive')} placeholder='Add course name' />{errors.course ? <p className="ml-1 text-xs text-destructive">{errors.course}</p> : null}</div>
            <div className="space-y-1"><FL>Licence / certificate name</FL><Input value={form.license_name} onChange={(e) => s('license_name')(e.target.value)} className={INPUT_BASE} placeholder='Add license name' /></div>
            <div className="space-y-1"><FL>Issuing body</FL><Input value={form.issuing_body} onChange={(e) => s('issuing_body')(e.target.value)} className={INPUT_BASE} placeholder='Add issuing body' /></div>
            <div className="space-y-1"><FL>Start date</FL><Input type="date" value={form.start_date} onChange={(e) => s('start_date')(e.target.value)} className={cn(INPUT_BASE, errors.start_date && 'border-destructive')} placeholder='Select start date' />{errors.start_date ? <p className="ml-1 text-xs text-destructive">{errors.start_date}</p> : null}</div>
            <div className="space-y-1"><FL>End date / expiry</FL><Input type="date" value={form.end_date} onChange={(e) => s('end_date')(e.target.value)} className={cn(INPUT_BASE, errors.end_date && 'border-destructive')} placeholder='Select end date' />{errors.end_date ? <p className="ml-1 text-xs text-destructive">{errors.end_date}</p> : null}</div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)} className="h-7 px-2 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleSave} className="h-7 px-2 text-xs gap-1"><PlusIcon className="size-3" /> Add Training</Button>
          </div>
        </div>
      ) : null}

      {records.length === 0 && pendingRecords.length === 0 && draftRecords.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground">No training records yet.</p>
      ) : null}

      {records.map((rec) => (
        <TrainingCard key={rec.id} rec={rec} />
      ))}
      {pendingRecords.map((rec) => (
        <TrainingCard key={rec.id} rec={rec.payload as TrainingForm} badge={<PendingRequestBadge />} />
      ))}
      {draftRecords.map((rec) => (
        <TrainingCard key={rec.clientId} rec={rec.payload as TrainingForm} badge={<DraftBadge />} onRemove={() => onRemoveDraft(rec.clientId)} />
      ))}
    </div>
  )
}

export function ProfileUpdateRequestForm({
  schema,
  initialValues,
  pendingFields,
  collections,
}: ProfileUpdateRequestFormProps) {
  const router = useRouter()
  const [formValues, setFormValues] = useState<Record<string, string>>(() => initializeFormValues(initialValues))
  const [draftRecordCreates, setDraftRecordCreates] = useState<DraftRecord[]>([])
  const [isPending, startTransition] = useTransition()

  const pendingSet = useMemo(() => new Set(pendingFields), [pendingFields])
  const fieldByKey = useMemo(() => buildFieldMap(schema), [schema])

  const handleFieldChange = (fieldKey: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [fieldKey]: value }))
  }

  const allSingleRecordKeys = useMemo(
    () => [
      ...PERSONAL_SECTIONS.flatMap((s) => [...s.fieldKeys]),
      ...CONTACT_SECTIONS.flatMap((s) => [...s.fieldKeys]),
      ...FINANCE_SECTIONS.flatMap((s) => [...s.fieldKeys]),
    ],
    []
  )

  const scalarDirtyCount = allSingleRecordKeys.reduce((acc, key) => {
    const field = fieldByKey.get(key)
    if (!field || !field.can_read || !field.can_write || pendingSet.has(key)) return acc
    return acc + ((formValues[key] ?? '') !== toStr(initialValues[key]) ? 1 : 0)
  }, 0)

  const draftCounts = useMemo(() => {
    return draftRecordCreates.reduce(
      (acc, draft) => {
        if (
          draft.table === 'employee_family' ||
          draft.table === 'employee_dependants' ||
          draft.table === 'employee_next_of_kin'
        ) {
          acc.relations += 1
        } else {
          acc.career += 1
        }
        return acc
      },
      { relations: 0, career: 0 }
    )
  }, [draftRecordCreates])

  const pendingCreatesByTable = useMemo(() => {
    const map = new Map<RecordCreateTable, PendingRecordCreate[]>()
    const tables: RecordCreateTable[] = [
      'employee_family',
      'employee_dependants',
      'employee_next_of_kin',
      'employee_experience',
      'employee_education',
      'employee_training',
    ]
    for (const table of tables) map.set(table, [])
    for (const row of collections.pendingRecordCreates) {
      const table = row.target_table as RecordCreateTable
      if (tables.includes(table)) map.get(table)?.push(row)
    }
    return map
  }, [collections.pendingRecordCreates])

  const addDraftRecord = (record: RecordCreateRequest) => {
    setDraftRecordCreates((prev) => [...prev, { ...record, clientId: crypto.randomUUID() }])
  }

  const removeDraftRecord = (clientId: string) => {
    setDraftRecordCreates((prev) => prev.filter((row) => row.clientId !== clientId))
  }

  const totalQueuedChanges = scalarDirtyCount + draftRecordCreates.length

  const activeTabs = TABS.filter((tab) => {
    if (tab.id === 'personal') {
      return PERSONAL_SECTIONS.some((section) => section.fieldKeys.some((key) => fieldByKey.get(key)?.can_read))
    }
    if (tab.id === 'contact') {
      return CONTACT_SECTIONS.some((section) => section.fieldKeys.some((key) => fieldByKey.get(key)?.can_read))
    }
    if (tab.id === 'finance') {
      return FINANCE_SECTIONS.some((section) => section.fieldKeys.some((key) => fieldByKey.get(key)?.can_read))
    }
    return true
  })

  const handleSubmit = () => {
    // Basic required-field validation for key identity/contact fields
    const REQUIRED_KEYS: string[] = [
      'employee_biodata.firstname',
      'employee_biodata.lastname',
      'employee_biodata.gender',
      'employees.email',
      'employees.phone',
    ]

    const missing: string[] = []
    for (const key of REQUIRED_KEYS) {
      const field = fieldByKey.get(key)
      if (!field || !field.can_read) continue
      const value = (formValues[key] ?? '').trim()
      if (!value) missing.push(field.label)
    }

    if (missing.length > 0) {
      toast.error(`Please fill in required fields: ${missing.join(', ')}`)
      return
    }

    const changes: Record<string, unknown> = {}
    for (const fields of Object.values(schema)) {
      for (const field of fields) {
        if (!field.can_read || !field.can_write) continue
        if (pendingSet.has(field.field_key)) continue
        const current = formValues[field.field_key] ?? ''
        const original = toStr(initialValues[field.field_key])
        if (current !== original) changes[field.field_key] = current === '' ? null : current
      }
    }

    if (Object.keys(changes).length === 0 && draftRecordCreates.length === 0) {
      toast.info('No changes to submit.')
      return
    }

    startTransition(async () => {
      const result = await createProfileUpdateRequestFromEss(
        changes,
        draftRecordCreates.map(({ table, payload }) => ({ table, payload }))
      )
      if (!result.success) {
        toast.error(result.error)
        return
      }

      setDraftRecordCreates([])
      toast.success('Your profile update request has been submitted. HR will review your changes.')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue={activeTabs[0]?.id ?? 'personal'}>
        <div className="overflow-x-auto border-b">
          <TabsList className="flex h-auto w-max min-w-full gap-0 rounded-none bg-transparent p-0">
            {activeTabs.map(({ id, label, Icon }) => {
              const scalarKeys =
                id === 'personal'
                  ? PERSONAL_SECTIONS.flatMap((s) => [...s.fieldKeys])
                  : id === 'contact'
                  ? CONTACT_SECTIONS.flatMap((s) => [...s.fieldKeys])
                  : id === 'finance'
                  ? FINANCE_SECTIONS.flatMap((s) => [...s.fieldKeys])
                  : []

              const scalarCount = scalarKeys.reduce((acc, key) => {
                const field = fieldByKey.get(key)
                if (!field || !field.can_read || !field.can_write || pendingSet.has(key)) return acc
                return acc + ((formValues[key] ?? '') !== toStr(initialValues[key]) ? 1 : 0)
              }, 0)

              const tabCount =
                id === 'relations' ? draftCounts.relations : id === 'career' ? draftCounts.career : scalarCount

              return (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="relative shrink-0 gap-1.5 rounded-none border-b-2 border-transparent px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  <Icon className="size-3.5" />
                  {label}
                  {tabCount > 0 ? (
                    <span className="ml-1 inline-flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
                      {tabCount}
                    </span>
                  ) : null}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>

        <TabsContent value="personal" className="mt-4">
          <div className="space-y-5">
            {PERSONAL_SECTIONS.map((section) => (
              <ScalarSectionCard
                key={section.id}
                title={section.title}
                fieldKeys={section.fieldKeys}
                fieldByKey={fieldByKey}
                formValues={formValues}
                initialValues={initialValues}
                pendingSet={pendingSet}
                onChange={handleFieldChange}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="contact" className="mt-4">
          <div className="space-y-5">
            {CONTACT_SECTIONS.map((section) => (
              <ScalarSectionCard
                key={section.id}
                title={section.title}
                fieldKeys={section.fieldKeys}
                fieldByKey={fieldByKey}
                formValues={formValues}
                initialValues={initialValues}
                pendingSet={pendingSet}
                onChange={handleFieldChange}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="finance" className="mt-4">
          <div className="space-y-5">
            {FINANCE_SECTIONS.map((section) => (
              <ScalarSectionCard
                key={section.id}
                title={section.title}
                fieldKeys={section.fieldKeys}
                fieldByKey={fieldByKey}
                formValues={formValues}
                initialValues={initialValues}
                pendingSet={pendingSet}
                onChange={handleFieldChange}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentsMockTab />
        </TabsContent>

        <TabsContent value="relations" className="mt-4">
          <div className="space-y-5">
            <PersonCreateSection
              title="Family records"
              table="employee_family"
              records={collections.family}
              pendingRecords={pendingCreatesByTable.get('employee_family') ?? []}
              draftRecords={draftRecordCreates.filter((row) => row.table === 'employee_family')}
              onAddDraft={addDraftRecord}
              onRemoveDraft={removeDraftRecord}
            />
            <NextOfKinCreateSection
              records={collections.nextOfKin}
              pendingRecords={pendingCreatesByTable.get('employee_next_of_kin') ?? []}
              draftRecords={draftRecordCreates.filter((row) => row.table === 'employee_next_of_kin')}
              onAddDraft={addDraftRecord}
              onRemoveDraft={removeDraftRecord}
            />
            <PersonCreateSection
              title="Dependant records"
              table="employee_dependants"
              records={collections.dependants}
              pendingRecords={pendingCreatesByTable.get('employee_dependants') ?? []}
              draftRecords={draftRecordCreates.filter((row) => row.table === 'employee_dependants')}
              onAddDraft={addDraftRecord}
              onRemoveDraft={removeDraftRecord}
            />
          </div>
        </TabsContent>

        <TabsContent value="career" className="mt-4">
          <div className="space-y-5">
            <ExperienceCreateSection
              records={collections.experience}
              pendingRecords={pendingCreatesByTable.get('employee_experience') ?? []}
              draftRecords={draftRecordCreates.filter((row) => row.table === 'employee_experience')}
              onAddDraft={addDraftRecord}
              onRemoveDraft={removeDraftRecord}
            />
            <EducationCreateSection
              records={collections.education}
              pendingRecords={pendingCreatesByTable.get('employee_education') ?? []}
              draftRecords={draftRecordCreates.filter((row) => row.table === 'employee_education')}
              onAddDraft={addDraftRecord}
              onRemoveDraft={removeDraftRecord}
            />
            <TrainingCreateSection
              records={collections.training}
              pendingRecords={pendingCreatesByTable.get('employee_training') ?? []}
              draftRecords={draftRecordCreates.filter((row) => row.table === 'employee_training')}
              onAddDraft={addDraftRecord}
              onRemoveDraft={removeDraftRecord}
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {totalQueuedChanges > 0 ? (
            <>
              <span className="font-semibold text-foreground">{totalQueuedChanges}</span>{' '}
              {totalQueuedChanges === 1 ? 'change' : 'changes'} queued — HR must approve before they take effect.
            </>
          ) : (
            'Edit fields above, add any new records you need, then submit for HR review.'
          )}
        </p>
        <Button
          onClick={handleSubmit}
          disabled={isPending || totalQueuedChanges === 0}
          size="sm"
          className="shrink-0"
        >
          {isPending ? <Loader2Icon className="mr-2 size-3.5 animate-spin" /> : null}
          Submit Request
        </Button>
      </div>
    </div>
  )
}