'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import {
  BriefcaseIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ClockIcon,
  CreditCardIcon,
  GraduationCapIcon,
  Loader2Icon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
  XCircleIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type {
  ChangeEvent,
  Employee360Response,
  Employee360Employee,
  Employee360Biodata,
  Employee360Address,
  Employee360BankDetails,
  Employee360Person,
  Employee360Experience,
  Employee360Education,
  Employee360Training,
} from '@/app/api/employees/[id]/360/route'
import {
  updateEmployeeCard,
  addEmployeeRecord,
  updateEmployeeRecord,
  deleteEmployeeRecord,
  type MultiRowTable,
} from '@/lib/actions/employee-update'
import type { DepartmentRow } from '@/lib/data/departments'
import type { JobRoleRow } from '@/lib/data/job-roles'
import type { LocationRow } from '@/lib/data/locations'
import type { LineManagerOption } from '@/components/dashboard/CreateEmployeeModal'

// ─── Props ────────────────────────────────────────────────────────────────────

type Employee360ModalProps = {
  employeeId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  departments: DepartmentRow[]
  jobRoles: JobRoleRow[]
  lineManagerOptions: LineManagerOption[]
  locations: LocationRow[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INPUT = 'h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm w-full focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
const SELECT = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'

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

const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((v) => ({ value: v, label: v }))
const GENOTYPE_OPTIONS = ['AA', 'AS', 'SS', 'AC'].map((v) => ({ value: v, label: v }))
const RELIGION_OPTIONS = ['Christianity', 'Islam', 'Traditional', 'Other'].map((v) => ({ value: v, label: v }))

const CONTRACT_TYPE_OPTIONS = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'fixed_term', label: 'Fixed Term' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'intern', label: 'Intern' },
  { value: 'temporary', label: 'Temporary' },
]

const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'probation', label: 'Probation' },
  { value: 'confirmed', label: 'Confirmed' },
]

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'savings', label: 'Savings' },
  { value: 'current', label: 'Current' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return d
  }
}

function mask(s: string | null | undefined, show = 4): string {
  if (!s) return '—'
  if (s.length <= show) return '••••'
  return '•'.repeat(s.length - show) + s.slice(-show)
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function FL({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted-foreground">{children}</label>
}

function FieldItem({
  label,
  value,
  lastChange,
}: {
  label: string
  value: string | number | boolean | null | undefined
  lastChange?: ChangeEvent
}) {
  const display =
    value === null || value === undefined || value === ''
      ? '—'
      : typeof value === 'boolean'
      ? value ? 'Yes' : 'No'
      : String(value)

  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium leading-snug">{display}</p>
      {lastChange && (
        <p className="text-[10px] text-muted-foreground/70">
          Updated {fmtDate(lastChange.created_at)}{lastChange.requester_name ? ` · ${lastChange.requester_name}` : ''}
        </p>
      )}
    </div>
  )
}

function CardShell({
  title,
  editing,
  saving,
  saveError,
  onEdit,
  onCancel,
  onSave,
  children,
}: {
  title: string
  editing: boolean
  saving: boolean
  saveError: string | null
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {!editing ? (
          <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 px-2 text-xs gap-1">
            <PencilIcon className="size-3" /> Edit
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving} className="h-7 px-2 text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={onSave} disabled={saving} className="h-7 px-2 text-xs gap-1">
              {saving ? <Loader2Icon className="size-3 animate-spin" /> : null}
              Save
            </Button>
          </div>
        )}
      </div>
      {saveError && <p className="text-xs text-destructive">{saveError}</p>}
      {children}
    </div>
  )
}

function SectionHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold">{title}</h3>
      <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={onAdd}>
        <PlusIcon className="size-3" /> Add
      </Button>
    </div>
  )
}

function RecordRow({ summary, onEdit, onDelete }: { summary: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-background">
      <span className="text-sm truncate flex-1">{summary}</span>
      <div className="flex items-center gap-1 ml-2 shrink-0">
        <Button variant="ghost" size="icon" className="size-7" onClick={onEdit}>
          <PencilIcon className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2Icon className="size-3" />
        </Button>
      </div>
    </div>
  )
}

// ─── Identity card (zod-validated) ───────────────────────────────────────────

const identitySchema = z.object({
  title: z.string().max(20, 'Title must be 20 characters or less'),
  firstname: z.string().min(1, 'First name is required').max(100, 'First name is too long'),
  lastname: z.string().min(1, 'Last name is required').max(100, 'Last name is too long'),
  othernames: z.string().max(100, 'Other names is too long'),
  gender: z.string().min(1, 'Gender is required'),
  date_of_birth: z.string().min(1, 'Date of birth is required')
    .refine((v) => !v || !isNaN(new Date(v).getTime()), { message: 'Please enter a valid date' })
    .refine((v) => !v || new Date(v) <= new Date(), { message: 'Date of birth cannot be in the future' }),
})

type IdentityFieldErrors = Partial<Record<keyof z.infer<typeof identitySchema>, string>>

function IdentityCard({
  employeeId,
  biodata,
  historyByField,
  onSaveSuccess,
}: {
  employeeId: string
  biodata: Employee360Biodata
  historyByField: Map<string, ChangeEvent>
  onSaveSuccess: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: biodata.title ?? '',
    firstname: biodata.firstname ?? '',
    lastname: biodata.lastname ?? '',
    othernames: biodata.othernames ?? '',
    gender: biodata.gender ?? '',
    date_of_birth: biodata.date_of_birth ?? '',
  })
  const [fieldErrors, setFieldErrors] = useState<IdentityFieldErrors>({})

  const s = (k: string) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    // clear the error for this field as soon as the user starts correcting it
    setFieldErrors((p) => ({ ...p, [k]: undefined }))
  }

  const startEdit = () => {
    setForm({
      title: biodata.title ?? '',
      firstname: biodata.firstname ?? '',
      lastname: biodata.lastname ?? '',
      othernames: biodata.othernames ?? '',
      gender: biodata.gender ?? '',
      date_of_birth: biodata.date_of_birth ?? '',
    })
    setFieldErrors({})
    setSaveError(null)
    setEditing(true)
  }

  const handleSave = async () => {
    // Run zod validation before hitting the server
    const result = identitySchema.safeParse(form)
    if (!result.success) {
      const errs: IdentityFieldErrors = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof IdentityFieldErrors
        if (!errs[field]) errs[field] = issue.message
      }
      setFieldErrors(errs)
      return
    }
    setSaving(true)
    setSaveError(null)
    const r = await updateEmployeeCard(employeeId, 'identity', result.data)
    if (r.success) { setEditing(false); toast.success('Identity updated'); await onSaveSuccess() }
    else setSaveError(r.error)
    setSaving(false)
  }

  const fe = fieldErrors

  return (
    <CardShell title="Identity" editing={editing} saving={saving} saveError={saveError} onEdit={startEdit} onCancel={() => setEditing(false)} onSave={handleSave}>
      {editing ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <FL>Title </FL>
            <Input value={form.title} onChange={(e) => s('title')(e.target.value)} placeholder="Mr / Mrs / Dr" className={cn(INPUT, fe.title ? 'border-destructive' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!')} />
            {fe.title && <p className="ml-1 text-xs text-destructive">{fe.title}</p>}
          </div>
          <div className="space-y-1">
            <FL>First name <span className="text-destructive">*</span></FL>
            <Input value={form.firstname} onChange={(e) => s('firstname')(e.target.value)} placeholder="First name" className={cn(INPUT, fe.firstname ? 'border-destructive' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!')} />
            {fe.firstname && <p className="ml-1 text-xs text-destructive">{fe.firstname}</p>}
          </div>
          <div className="space-y-1">
            <FL>Last name <span className="text-destructive">*</span></FL>
            <Input value={form.lastname} onChange={(e) => s('lastname')(e.target.value)} placeholder="Last name" className={cn(INPUT, fe.lastname ? 'border-destructive' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!')} />
            {fe.lastname && <p className="ml-1 text-xs text-destructive">{fe.lastname}</p>}
          </div>
          <div className="space-y-1">
            <FL>Other names </FL>
            <Input value={form.othernames} onChange={(e) => s('othernames')(e.target.value)} placeholder="Other names" className={cn(INPUT, fe.othernames ? 'border-destructive' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!')} />
            {fe.othernames && <p className="ml-1 text-xs text-destructive">{fe.othernames}</p>}
          </div>
          <div className="space-y-1">
            <FL>Gender <span className="text-destructive">*</span></FL>
            <select value={form.gender} onChange={(e) => s('gender')(e.target.value)} className={cn(SELECT, fe.gender ? 'border-destructive' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!')}>
              <option value="">Select…</option>
              {GENDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {fe.gender && <p className="ml-1 text-xs text-destructive">{fe.gender}</p>}
          </div>
          <div className="space-y-1">
            <FL>Date of birth <span className="text-destructive">*</span></FL>
            <Input type="date" value={form.date_of_birth} onChange={(e) => s('date_of_birth')(e.target.value)} className={cn(INPUT, fe.date_of_birth ? 'border-destructive' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!')} />
            {fe.date_of_birth && <p className="ml-1 text-xs text-destructive">{fe.date_of_birth}</p>}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldItem label="Title" value={biodata.title} lastChange={historyByField.get('title')} />
          <FieldItem label="First name" value={biodata.firstname} lastChange={historyByField.get('firstname')} />
          <FieldItem label="Last name" value={biodata.lastname} lastChange={historyByField.get('lastname')} />
          <FieldItem label="Other names" value={biodata.othernames} lastChange={historyByField.get('othernames')} />
          <FieldItem label="Gender" value={biodata.gender} lastChange={historyByField.get('gender')} />
          <FieldItem label="Date of birth" value={fmtDate(biodata.date_of_birth)} lastChange={historyByField.get('date_of_birth')} />
        </div>
      )}
    </CardShell>
  )
}

// ─── OriginCard ───────────────────────────────────────────────────────────────

const originSchema = z.object({
  place_of_birth: z.string().max(150, 'Too long'),
  lga: z.string().max(100, 'Too long'),
  state: z.string().min(1, 'State is required'),
  country: z.literal('Nigeria'),
})
type OriginFieldErrors = Partial<Record<keyof z.infer<typeof originSchema>, string>>

function OriginCard({
  employeeId,
  biodata,
  historyByField,
  onSaveSuccess,
}: {
  employeeId: string
  biodata: Employee360Biodata
  historyByField: Map<string, ChangeEvent>
  onSaveSuccess: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState({
    place_of_birth: biodata.place_of_birth ?? '',
    lga: biodata.lga ?? '',
    state: biodata.state ?? '',
    country: 'Nigeria' as const,
  })
  const [fieldErrors, setFieldErrors] = useState<OriginFieldErrors>({})
  const s = (k: string) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setFieldErrors((p) => ({ ...p, [k]: undefined }))
  }

  const startEdit = () => {
    setForm({ place_of_birth: biodata.place_of_birth ?? '', lga: biodata.lga ?? '', state: biodata.state ?? '', country: 'Nigeria' })
    setFieldErrors({}); setSaveError(null); setEditing(true)
  }

  const handleSave = async () => {
    const result = originSchema.safeParse(form)
    if (!result.success) {
      const errs: OriginFieldErrors = {}
      for (const issue of result.error.issues) {
        const f = issue.path[0] as keyof OriginFieldErrors
        if (!errs[f]) errs[f] = issue.message
      }
      setFieldErrors(errs); return
    }
    setSaving(true); setSaveError(null)
    const r = await updateEmployeeCard(employeeId, 'origin', result.data)
    if (r.success) { setEditing(false); toast.success('Origin updated'); await onSaveSuccess() }
    else setSaveError(r.error)
    setSaving(false)
  }

  const fe = fieldErrors
  return (
    <CardShell title="Origin" editing={editing} saving={saving} saveError={saveError} onEdit={startEdit} onCancel={() => setEditing(false)} onSave={handleSave}>
      {editing ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <FL>Place of birth</FL>
            <Input value={form.place_of_birth} onChange={(e) => s('place_of_birth')(e.target.value)} placeholder="Where's your place of birth?" className={cn(INPUT, fe.place_of_birth ? 'border-destructive' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!')} />
            {fe.place_of_birth && <p className="ml-1 text-xs text-destructive">{fe.place_of_birth}</p>}
          </div>
          <div className="space-y-1">
            <FL>LGA</FL>
            <Input value={form.lga} onChange={(e) => s('lga')(e.target.value)} placeholder="Local government area" className={cn(INPUT, fe.lga ? 'border-destructive' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!')} />
            {fe.lga && <p className="ml-1 text-xs text-destructive">{fe.lga}</p>}
          </div>
          <div className="space-y-1">
            <FL>State <span className="text-destructive">*</span></FL>
            <select value={form.state} onChange={(e) => s('state')(e.target.value)} className={cn(SELECT, fe.state ? 'border-destructive' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!')}>
              <option value="">Select state…</option>
              {NIGERIA_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
            {fe.state && <p className="ml-1 text-xs text-destructive">{fe.state}</p>}
          </div>
          <div className="space-y-1">
            <FL>Country <span className="text-destructive">*</span></FL>
            <Input value="Nigeria" disabled className={cn(INPUT, 'bg-muted text-muted-foreground cursor-not-allowed')} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldItem label="Place of birth" value={biodata.place_of_birth} lastChange={historyByField.get('place_of_birth')} />
          <FieldItem label="LGA" value={biodata.lga} lastChange={historyByField.get('lga')} />
          <FieldItem label="State" value={biodata.state} lastChange={historyByField.get('state')} />
          <FieldItem label="Country" value={biodata.country ?? 'Nigeria'} lastChange={historyByField.get('country')} />
        </div>
      )}
    </CardShell>
  )
}

// ─── FamilyCard (biodata fields) ──────────────────────────────────────────────

const familySchema = z.object({
  marital_status: z.string(),
  mothers_maiden_name: z.string().max(100, 'Too long'),
  spouse: z.string().max(100, 'Too long'),
  spouse_phone: z.string().max(20, 'Too long').refine(
    (v) => !v || /^\+?[\d\s\-().]{7,}$/.test(v),
    { message: 'Invalid phone number' }
  ),
  number_of_kids: z.string().refine(
    (v) => v === '' || (!isNaN(Number(v)) && Number(v) >= 0 && Number.isInteger(Number(v))),
    { message: 'Must be a non-negative whole number' }
  ),
  ethnic_group: z.string().min(1, 'Ethnic group is required').max(100, 'Too long'),
  religion: z.string().min(1, 'Religion is required'),
})

type FamilyFieldErrors = Partial<Record<keyof z.infer<typeof familySchema>, string>>

function FamilyCard({
  employeeId,
  biodata,
  historyByField,
  onSaveSuccess,
}: {
  employeeId: string
  biodata: Employee360Biodata
  historyByField: Map<string, ChangeEvent>
  onSaveSuccess: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState({
    marital_status: biodata.marital_status ?? '',
    mothers_maiden_name: biodata.mothers_maiden_name ?? '',
    spouse: biodata.spouse ?? '',
    spouse_phone: biodata.spouse_phone ?? '',
    number_of_kids: String(biodata.number_of_kids ?? ''),
    ethnic_group: biodata.ethnic_group ?? '',
    religion: biodata.religion ?? '',
  })
  const [fieldErrors, setFieldErrors] = useState<FamilyFieldErrors>({})
  const s = (k: string) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setFieldErrors((p) => ({ ...p, [k]: undefined }))
  }

  const startEdit = () => {
    setForm({
      marital_status: biodata.marital_status ?? '',
      mothers_maiden_name: biodata.mothers_maiden_name ?? '',
      spouse: biodata.spouse ?? '',
      spouse_phone: biodata.spouse_phone ?? '',
      number_of_kids: String(biodata.number_of_kids ?? ''),
      ethnic_group: biodata.ethnic_group ?? '',
      religion: biodata.religion ?? '',
    })
    setFieldErrors({}); setSaveError(null); setEditing(true)
  }

  const handleSave = async () => {
    const result = familySchema.safeParse(form)
    if (!result.success) {
      const errs: FamilyFieldErrors = {}
      for (const issue of result.error.issues) {
        const f = issue.path[0] as keyof FamilyFieldErrors
        if (!errs[f]) errs[f] = issue.message
      }
      setFieldErrors(errs); return
    }
    setSaving(true); setSaveError(null)
    const r = await updateEmployeeCard(employeeId, 'family', {
      ...result.data,
      number_of_kids: result.data.number_of_kids === '' ? null : Number(result.data.number_of_kids),
    })
    if (r.success) { setEditing(false); toast.success('Family info updated'); await onSaveSuccess() }
    else setSaveError(r.error)
    setSaving(false)
  }

  const fe = fieldErrors
  return (
    <CardShell title="Family Background" editing={editing} saving={saving} saveError={saveError} onEdit={startEdit} onCancel={() => setEditing(false)} onSave={handleSave}>
      {editing ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <FL>Marital status </FL>
            <select value={form.marital_status} onChange={(e) => s('marital_status')(e.target.value)} className={cn(SELECT, fe.marital_status ? 'border-destructive' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!')}>
              <option value="">Select…</option>
              {MARITAL_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {fe.marital_status && <p className="ml-1 text-xs text-destructive">{fe.marital_status}</p>}
          </div>
          <div className="space-y-1">
            <FL>Religion <span className="text-destructive">*</span></FL>
            <select value={form.religion} onChange={(e) => s('religion')(e.target.value)} className={cn(SELECT, fe.religion ? 'border-destructive' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!')}>
              <option value="">Select…</option>
              {RELIGION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {fe.religion && <p className="ml-1 text-xs text-destructive">{fe.religion}</p>}
          </div>
          {[
            { k: 'mothers_maiden_name', l: "Mother's maiden name", ph: 'Input your mother\'s maiden name', type: 'text', req: false },
            { k: 'ethnic_group', l: 'Ethnic group', ph: 'e.g Igbo, Yoruba, Hausa, etc.', type: 'text', req: true },
            { k: 'spouse', l: 'Spouse name', ph: 'Input your spouse\'s name', type: 'text', req: false },
            { k: 'spouse_phone', l: 'Spouse phone', ph: 'Input your spouse\'s phone number', type: 'tel', req: false },
            { k: 'number_of_kids', l: 'Number of kids', ph: 'Input the number of kids you have', type: 'number', req: false },
          ].map(({ k, l, ph, type, req }) => (
            <div key={k} className="space-y-1">
              <FL>{l} {req ? <span className="text-destructive">*</span> : null}</FL>
              <Input
                required={req}
                type={type}
                value={form[k as keyof typeof form]}
                onChange={(e) => s(k)(e.target.value)}
                placeholder={ph}
                min={type === 'number' ? 0 : undefined}
                className={cn(INPUT, fe[k as keyof FamilyFieldErrors] ? 'border-destructive' : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!')}
              />
              {fe[k as keyof FamilyFieldErrors] && <p className="ml-1 text-xs text-destructive">{fe[k as keyof FamilyFieldErrors]}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldItem label="Marital status" value={biodata.marital_status} lastChange={historyByField.get('marital_status')} />
          <FieldItem label="Religion" value={biodata.religion} lastChange={historyByField.get('religion')} />
          <FieldItem label="Mother's maiden name" value={biodata.mothers_maiden_name} lastChange={historyByField.get('mothers_maiden_name')} />
          <FieldItem label="Ethnic group" value={biodata.ethnic_group} lastChange={historyByField.get('ethnic_group')} />
          <FieldItem label="Spouse" value={biodata.spouse} lastChange={historyByField.get('spouse')} />
          <FieldItem label="Spouse phone" value={biodata.spouse_phone} lastChange={historyByField.get('spouse_phone')} />
          <FieldItem label="Number of kids" value={biodata.number_of_kids} lastChange={historyByField.get('number_of_kids')} />
        </div>
      )}
    </CardShell>
  )
}

// ─── HealthCard ───────────────────────────────────────────────────────────────

const healthSchema = z.object({
  blood_group: z.string(),
  genotype: z.string(),
  allergies: z.string().max(500, 'Too long (max 500 characters)'),
  medical_history: z.string().max(1000, 'Too long (max 1000 characters)'),
})
type HealthFieldErrors = Partial<Record<keyof z.infer<typeof healthSchema>, string>>

function HealthCard({
  employeeId,
  biodata,
  historyByField,
  onSaveSuccess,
}: {
  employeeId: string
  biodata: Employee360Biodata
  historyByField: Map<string, ChangeEvent>
  onSaveSuccess: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState({
    blood_group: biodata.blood_group ?? '',
    genotype: biodata.genotype ?? '',
    allergies: biodata.allergies ?? '',
    medical_history: biodata.medical_history ?? '',
  })
  const [fieldErrors, setFieldErrors] = useState<HealthFieldErrors>({})
  const s = (k: string) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setFieldErrors((p) => ({ ...p, [k]: undefined }))
  }

  const startEdit = () => {
    setForm({ blood_group: biodata.blood_group ?? '', genotype: biodata.genotype ?? '', allergies: biodata.allergies ?? '', medical_history: biodata.medical_history ?? '' })
    setFieldErrors({}); setSaveError(null); setEditing(true)
  }

  const handleSave = async () => {
    const result = healthSchema.safeParse(form)
    if (!result.success) {
      const errs: HealthFieldErrors = {}
      for (const issue of result.error.issues) {
        const f = issue.path[0] as keyof HealthFieldErrors
        if (!errs[f]) errs[f] = issue.message
      }
      setFieldErrors(errs); return
    }
    setSaving(true); setSaveError(null)
    const r = await updateEmployeeCard(employeeId, 'health', result.data)
    if (r.success) { setEditing(false); toast.success('Health info updated'); await onSaveSuccess() }
    else setSaveError(r.error)
    setSaving(false)
  }

  const fe = fieldErrors
  return (
    <CardShell title="Health" editing={editing} saving={saving} saveError={saveError} onEdit={startEdit} onCancel={() => setEditing(false)} onSave={handleSave}>
      {editing ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <FL>Blood group </FL>
            <select value={form.blood_group} onChange={(e) => s('blood_group')(e.target.value)} className={cn(SELECT, fe.blood_group && 'border-destructive')}>
              <option value="">Select…</option>
              {BLOOD_GROUP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {fe.blood_group && <p className="ml-1 text-xs text-destructive">{fe.blood_group}</p>}
          </div>
          <div className="space-y-1">
            <FL>Genotype </FL>
            <select value={form.genotype} onChange={(e) => s('genotype')(e.target.value)} className={cn(SELECT, fe.genotype && 'border-destructive')}>
              <option value="">Select…</option>
              {GENOTYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {fe.genotype && <p className="ml-1 text-xs text-destructive">{fe.genotype}</p>}
          </div>
          <div className="space-y-1 sm:col-span-2">
            <FL>Allergies</FL>
            <Input value={form.allergies} onChange={(e) => s('allergies')(e.target.value)} placeholder="Known allergies" className={cn(INPUT, fe.allergies && 'border-destructive')} />
            {fe.allergies && <p className="ml-1 text-xs text-destructive">{fe.allergies}</p>}
          </div>
          <div className="space-y-1 sm:col-span-2">
            <FL>Medical history</FL>
            <Input value={form.medical_history} onChange={(e) => s('medical_history')(e.target.value)} placeholder="Medical conditions, notes" className={cn(INPUT, fe.medical_history && 'border-destructive')} />
            {fe.medical_history && <p className="ml-1 text-xs text-destructive">{fe.medical_history}</p>}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldItem label="Blood group" value={biodata.blood_group} lastChange={historyByField.get('blood_group')} />
          <FieldItem label="Genotype" value={biodata.genotype} lastChange={historyByField.get('genotype')} />
          <FieldItem label="Allergies" value={biodata.allergies} lastChange={historyByField.get('allergies')} />
          <FieldItem label="Medical history" value={biodata.medical_history} lastChange={historyByField.get('medical_history')} />
        </div>
      )}
    </CardShell>
  )
}

// ─── ContactDetailsCard ───────────────────────────────────────────────────────

const contactSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  phone: z.string().min(1, 'Phone is required').refine(
    (v) => !v || /^\+?[\d\s\-().]{7,20}$/.test(v),
    { message: 'Invalid phone number' }
  ),
  alternate_phone: z.string().refine(
    (v) => !v || /^\+?[\d\s\-().]{7,20}$/.test(v),
    { message: 'Invalid phone number' }
  ),
  alternate_email: z.string().refine(
    (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    { message: 'Invalid email address' }
  ),
})
type ContactFieldErrors = Partial<Record<keyof z.infer<typeof contactSchema>, string>>

function ContactDetailsCard({
  employeeId,
  employee,
  biodata,
  historyByField,
  onSaveSuccess,
}: {
  employeeId: string
  employee: Employee360Employee
  biodata: Employee360Biodata
  historyByField: Map<string, ChangeEvent>
  onSaveSuccess: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState({
    email: employee.email ?? '',
    phone: employee.phone ?? '',
    alternate_phone: biodata.alternate_phone ?? '',
    alternate_email: biodata.alternate_email ?? '',
  })
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({})
  const s = (k: string) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setFieldErrors((p) => ({ ...p, [k]: undefined }))
  }

  const startEdit = () => {
    setForm({ email: employee.email ?? '', phone: employee.phone ?? '', alternate_phone: biodata.alternate_phone ?? '', alternate_email: biodata.alternate_email ?? '' })
    setFieldErrors({}); setSaveError(null); setEditing(true)
  }

  const handleSave = async () => {
    const result = contactSchema.safeParse(form)
    if (!result.success) {
      const errs: ContactFieldErrors = {}
      for (const issue of result.error.issues) {
        const f = issue.path[0] as keyof ContactFieldErrors
        if (!errs[f]) errs[f] = issue.message
      }
      setFieldErrors(errs); return
    }
    setSaving(true); setSaveError(null)
    const r = await updateEmployeeCard(employeeId, 'contact', result.data)
    if (r.success) { setEditing(false); toast.success('Contact details updated'); await onSaveSuccess() }
    else setSaveError(r.error)
    setSaving(false)
  }

  const fe = fieldErrors
  return (
    <CardShell title="Contact Details" editing={editing} saving={saving} saveError={saveError} onEdit={startEdit} onCancel={() => setEditing(false)} onSave={handleSave}>
      {editing ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { k: 'email', l: 'Email', ph: 'Work email', type: 'email', req: true },
            { k: 'phone', l: 'Phone', ph: 'Phone number', type: 'tel', req: true },
            { k: 'alternate_phone', l: 'Alternate phone', ph: 'Your alternate phone number', type: 'tel', req: false },
            { k: 'alternate_email', l: 'Alternate email', ph: 'Your personal email address', type: 'email', req: false },
          ].map(({ k, l, ph, type, req }) => (
            <div key={k} className="space-y-1">
              <FL>{l}{req && <span className="text-destructive"> *</span>}</FL>
              <Input type={type} value={form[k as keyof typeof form]} onChange={(e) => s(k)(e.target.value)} placeholder={ph} className={cn(INPUT, fe[k as keyof ContactFieldErrors] && 'border-destructive')} />
              {fe[k as keyof ContactFieldErrors] && <p className="ml-1 text-xs text-destructive">{fe[k as keyof ContactFieldErrors]}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldItem label="Email" value={employee.email} lastChange={historyByField.get('email')} />
          <FieldItem label="Phone" value={employee.phone} lastChange={historyByField.get('phone')} />
          <FieldItem label="Alternate phone" value={biodata.alternate_phone} lastChange={historyByField.get('alternate_phone')} />
          <FieldItem label="Alternate email" value={biodata.alternate_email} lastChange={historyByField.get('alternate_email')} />
        </div>
      )}
    </CardShell>
  )
}

// ─── ResidentialAddressCard ───────────────────────────────────────────────────

const addressSchema = z.object({
  residential_address: z.string().max(255, 'Too long'),
  nearest_bus_stop: z.string().max(150, 'Too long'),
  nearest_landmark: z.string().max(150, 'Too long'),
  city: z.string().max(100, 'Too long'),
  state: z.string().min(1, 'State is required'),
  country: z.literal('Nigeria'),
})
type AddressFieldErrors = Partial<Record<keyof z.infer<typeof addressSchema>, string>>

function ResidentialAddressCard({
  employeeId,
  address,
  onSaveSuccess,
}: {
  employeeId: string
  address: Employee360Address | null
  onSaveSuccess: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const emptyForm = { residential_address: '', nearest_bus_stop: '', nearest_landmark: '', city: '', state: '', country: 'Nigeria' as const }
  const fromAddress = () => address
    ? { residential_address: address.residential_address ?? '', nearest_bus_stop: address.nearest_bus_stop ?? '', nearest_landmark: address.nearest_landmark ?? '', city: address.city ?? '', state: address.state ?? '', country: 'Nigeria' as const }
    : emptyForm
  const [form, setForm] = useState(fromAddress)
  const [fieldErrors, setFieldErrors] = useState<AddressFieldErrors>({})
  const s = (k: string) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setFieldErrors((p) => ({ ...p, [k]: undefined }))
  }

  const startEdit = () => { setForm(fromAddress()); setFieldErrors({}); setSaveError(null); setEditing(true) }

  const handleSave = async () => {
    const result = addressSchema.safeParse(form)
    if (!result.success) {
      const errs: AddressFieldErrors = {}
      for (const issue of result.error.issues) {
        const f = issue.path[0] as keyof AddressFieldErrors
        if (!errs[f]) errs[f] = issue.message
      }
      setFieldErrors(errs); return
    }
    setSaving(true); setSaveError(null)
    const r = await updateEmployeeCard(employeeId, 'address_card', result.data)
    if (r.success) { setEditing(false); toast.success('Address updated'); await onSaveSuccess() }
    else setSaveError(r.error)
    setSaving(false)
  }

  const fe = fieldErrors
  return (
    <CardShell title="Residential Address" editing={editing} saving={saving} saveError={saveError} onEdit={startEdit} onCancel={() => setEditing(false)} onSave={handleSave}>
      {editing ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <FL>Street address </FL>
            <Input value={form.residential_address} onChange={(e) => s('residential_address')(e.target.value)} placeholder="House number, street" className={cn(INPUT, fe.residential_address && 'border-destructive')} />
            {fe.residential_address && <p className="ml-1 text-xs text-destructive">{fe.residential_address}</p>}
          </div>
          <div className="space-y-1">
            <FL>Nearest bus stop</FL>
            <Input value={form.nearest_bus_stop} onChange={(e) => s('nearest_bus_stop')(e.target.value)} className={cn(INPUT, fe.nearest_bus_stop && 'border-destructive')} placeholder='e.g. Ojota bus stop' />
            {fe.nearest_bus_stop && <p className="ml-1 text-xs text-destructive">{fe.nearest_bus_stop}</p>}
          </div>
          <div className="space-y-1">
            <FL>Nearest landmark</FL>
            <Input value={form.nearest_landmark} onChange={(e) => s('nearest_landmark')(e.target.value)} className={cn(INPUT, fe.nearest_landmark && 'border-destructive')} placeholder='Your nearest landmark' />
            {fe.nearest_landmark && <p className="ml-1 text-xs text-destructive">{fe.nearest_landmark}</p>}
          </div>
          <div className="space-y-1">
            <FL>City </FL>
            <Input value={form.city} onChange={(e) => s('city')(e.target.value)} placeholder="e.g. Ikeja" className={cn(INPUT, fe.city && 'border-destructive')} />
            {fe.city && <p className="ml-1 text-xs text-destructive">{fe.city}</p>}
          </div>
          <div className="space-y-1">
            <FL>State <span className="text-destructive">*</span></FL>
            <select value={form.state} onChange={(e) => s('state')(e.target.value)} className={cn(SELECT, fe.state && 'border-destructive')}>
              <option value="">Select state…</option>
              {NIGERIA_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
            {fe.state && <p className="ml-1 text-xs text-destructive">{fe.state}</p>}
          </div>
          <div className="space-y-1">
            <FL>Country <span className="text-destructive">*</span></FL>
            <Input value="Nigeria" disabled className={cn(INPUT, 'bg-muted text-muted-foreground cursor-not-allowed')} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldItem label="Street address" value={address?.residential_address} />
          <FieldItem label="Nearest bus stop" value={address?.nearest_bus_stop} />
          <FieldItem label="Nearest landmark" value={address?.nearest_landmark} />
          <FieldItem label="City" value={address?.city} />
          <FieldItem label="State" value={address?.state} />
          <FieldItem label="Country" value={address?.country} />
        </div>
      )}
    </CardShell>
  )
}

// ─── RoleCard ─────────────────────────────────────────────────────────────────

const roleSchema = z.object({
  department_id: z.string().min(1, 'Department is required'),
  job_role_id: z.string().min(1, 'Job role is required'),
  manager_id: z.string(),
  report_location: z.string(),
})
type RoleFieldErrors = Partial<Record<keyof z.infer<typeof roleSchema>, string>>

function RoleCard({
  employeeId,
  employee,
  historyByField,
  onSaveSuccess,
  departments,
  jobRoles,
  lineManagerOptions,
  locations,
}: {
  employeeId: string
  employee: Employee360Employee
  historyByField: Map<string, ChangeEvent>
  onSaveSuccess: () => Promise<void>
  departments: DepartmentRow[]
  jobRoles: JobRoleRow[]
  lineManagerOptions: LineManagerOption[]
  locations: LocationRow[]
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState({
    department_id: employee.department_id ?? '',
    job_role_id: employee.job_role_id ?? '',
    manager_id: employee.manager_id ?? '',
    report_location: employee.report_location ?? '',
  })
  const [fieldErrors, setFieldErrors] = useState<RoleFieldErrors>({})
  const [managerOpen, setManagerOpen] = useState(false)
  const [managerSearch, setManagerSearch] = useState('')

  const s = (k: string) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setFieldErrors((p) => ({ ...p, [k]: undefined }))
  }

  const handleDepartmentChange = (deptId: string) => {
    setForm((p) => ({ ...p, department_id: deptId, job_role_id: '' }))
    setFieldErrors((p) => ({ ...p, department_id: undefined, job_role_id: undefined }))
  }

  const handleManagerOpenChange = (open: boolean) => {
    setManagerOpen(open)
    if (!open) setManagerSearch('')
  }

  const availableJobRoles = useMemo(
    () => jobRoles.filter((jr) => jr.department_id === form.department_id),
    [jobRoles, form.department_id]
  )

  const availableManagers = useMemo(
    () => lineManagerOptions.filter((m) => m.id !== employeeId),
    [lineManagerOptions, employeeId]
  )

  const filteredManagers = useMemo(() => {
    if (!managerSearch.trim()) return availableManagers.slice(0, 8)
    const q = managerSearch.trim().toLowerCase()
    return availableManagers.filter(
      (m) => m.name.toLowerCase().includes(q) || m.jobRoleDisplay.toLowerCase().includes(q)
    )
  }, [managerSearch, availableManagers])

  const selectedManager = useMemo(
    () => availableManagers.find((m) => m.id === form.manager_id) ?? null,
    [availableManagers, form.manager_id]
  )

  const startEdit = () => {
    setForm({ department_id: employee.department_id ?? '', job_role_id: employee.job_role_id ?? '', manager_id: employee.manager_id ?? '', report_location: employee.report_location ?? '' })
    setFieldErrors({}); setManagerSearch(''); setSaveError(null); setEditing(true)
  }

  const handleSave = async () => {
    const result = roleSchema.safeParse(form)
    if (!result.success) {
      const errs: RoleFieldErrors = {}
      for (const issue of result.error.issues) {
        const f = issue.path[0] as keyof RoleFieldErrors
        if (!errs[f]) errs[f] = issue.message
      }
      setFieldErrors(errs); return
    }
    setSaving(true); setSaveError(null)
    const r = await updateEmployeeCard(employeeId, 'role', {
      department_id: result.data.department_id || null,
      job_role_id: result.data.job_role_id || null,
      manager_id: result.data.manager_id || null,
      report_location: result.data.report_location || null,
    })
    if (r.success) { setEditing(false); toast.success('Role updated'); await onSaveSuccess() }
    else setSaveError(r.error)
    setSaving(false)
  }

  const fe = fieldErrors
  return (
    <CardShell title="Role & Reporting" editing={editing} saving={saving} saveError={saveError} onEdit={startEdit} onCancel={() => setEditing(false)} onSave={handleSave}>
      {editing ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Department */}
          <div className="space-y-1">
            <FL>Department <span className="text-destructive">*</span></FL>
            <select
              value={form.department_id}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              className={cn(SELECT, fe.department_id && 'border-destructive')}
            >
              <option value="">Select department…</option>
              {departments.filter((d) => d.is_active).map((d) => (
                <option key={d.id} value={d.id}>{d.name}{d.code ? ` (${d.code})` : ''}</option>
              ))}
            </select>
            {fe.department_id && <p className="ml-1 text-xs text-destructive">{fe.department_id}</p>}
          </div>

          {/* Job role — depends on department */}
          <div className="space-y-1">
            <FL>Job role <span className="text-destructive">*</span></FL>
            <select
              value={form.job_role_id}
              onChange={(e) => s('job_role_id')(e.target.value)}
              disabled={!form.department_id || availableJobRoles.length === 0}
              className={cn(SELECT, 'disabled:opacity-50', fe.job_role_id && 'border-destructive')}
            >
              <option value="">
                {!form.department_id
                  ? 'Select department first'
                  : availableJobRoles.length === 0
                    ? 'No roles for this department'
                    : 'Select job role…'}
              </option>
              {availableJobRoles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}{r.code ? ` (${r.code})` : ''}</option>
              ))}
            </select>
            {fe.job_role_id && <p className="ml-1 text-xs text-destructive">{fe.job_role_id}</p>}
          </div>

          {/* Line manager — popover with search */}
          <div className="space-y-1 sm:col-span-2">
            <FL>Line manager</FL>
            <Popover open={managerOpen} onOpenChange={handleManagerOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={managerOpen}
                  className={cn('h-9 w-full justify-between font-normal', !selectedManager && 'text-muted-foreground')}
                >
                  <span className="truncate">{selectedManager ? selectedManager.name : 'Select line manager'}</span>
                  <ChevronDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                <div className="border-b p-2">
                  <div className="relative">
                    <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or role…"
                      className="h-8 pl-8 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
                      value={managerSearch}
                      onChange={(e) => setManagerSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-auto p-1">
                  <button
                    type="button"
                    className={cn('mb-1 flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent', !form.manager_id && 'bg-accent')}
                    onClick={() => { s('manager_id')(''); setManagerOpen(false) }}
                  >
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback><UserIcon className="size-4" /></AvatarFallback>
                    </Avatar>
                    <span className="text-muted-foreground">None</span>
                  </button>
                  {filteredManagers.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">No manager found.</p>
                  ) : filteredManagers.map((m) => {
                    const initials = m.name.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={cn('mb-1 flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent', form.manager_id === m.id && 'bg-accent')}
                        onClick={() => { s('manager_id')(m.id); setManagerOpen(false); setManagerSearch('') }}
                      >
                        <Avatar className="size-8 shrink-0">
                          {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt={m.name} /> : null}
                          <AvatarFallback>{initials || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="truncate font-medium">{m.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{m.jobRoleDisplay}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Work location */}
          <div className="space-y-1 sm:col-span-2">
            <FL>Work location</FL>
            <select value={form.report_location} onChange={(e) => s('report_location')(e.target.value)} className={SELECT}>
              <option value="">Select…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.address ?? [l.state, l.country].filter(Boolean).join(', ')}</option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldItem
            label="Department"
            value={employee.department_name ? `${employee.department_name}${employee.department_code ? ` (${employee.department_code})` : ''}` : null}
            lastChange={historyByField.get('department_id')}
          />
          <FieldItem
            label="Job role"
            value={employee.job_role_title ? `${employee.job_role_title}${employee.job_role_code ? ` (${employee.job_role_code})` : ''}` : null}
            lastChange={historyByField.get('job_role_id')}
          />
          <FieldItem label="Line manager" value={employee.manager_name} lastChange={historyByField.get('manager_id')} />
          <FieldItem label="Work location" value={employee.location_address} lastChange={historyByField.get('report_location')} />
        </div>
      )}
    </CardShell>
  )
}

// ─── ContractCard ─────────────────────────────────────────────────────────────

const OPEN_ENDED_CONTRACTS = ['permanent', 'part_time', '']

const contractSchema = z.object({
  staff_id: z.string().min(1, 'Staff ID is required').max(50, 'Too long'),
  contract_type: z.string().min(1, 'Contract type is required'),
  employment_status: z.string().min(1, 'Employment status is required'),
  start_date: z.string().min(1, 'Start date is required').refine(
    (v) => !isNaN(new Date(v).getTime()),
    { message: 'Invalid date' }
  ),
  end_date: z.string().refine(
    (v) => !v || !isNaN(new Date(v).getTime()),
    { message: 'Invalid date' }
  ),
}).refine(
  (d) => {
    if (OPEN_ENDED_CONTRACTS.includes(d.contract_type)) return true
    return !!d.end_date && d.end_date.trim() !== ''
  },
  { message: 'End date is required for this contract type', path: ['end_date'] }
).refine(
  (d) => !d.end_date || !d.start_date || new Date(d.end_date) >= new Date(d.start_date),
  { message: 'End date must not be before start date', path: ['end_date'] }
)
type ContractFieldErrors = Partial<Record<'staff_id' | 'contract_type' | 'employment_status' | 'start_date' | 'end_date', string>>

function ContractCard({
  employeeId,
  employee,
  historyByField,
  onSaveSuccess,
}: {
  employeeId: string
  employee: Employee360Employee
  historyByField: Map<string, ChangeEvent>
  onSaveSuccess: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState({
    staff_id: employee.staff_id ?? '',
    contract_type: employee.contract_type ?? '',
    employment_status: employee.employment_status ?? '',
    start_date: employee.start_date ?? '',
    end_date: employee.end_date ?? '',
  })
  const [fieldErrors, setFieldErrors] = useState<ContractFieldErrors>({})
  const s = (k: string) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setFieldErrors((p) => ({ ...p, [k]: undefined }))
  }

  const handleContractTypeChange = (v: string) => {
    const end_date = OPEN_ENDED_CONTRACTS.includes(v) ? '' : form.end_date
    setForm((p) => ({ ...p, contract_type: v, end_date }))
    setFieldErrors((p) => ({ ...p, contract_type: undefined, end_date: undefined }))
  }

  const isOpenEnded = OPEN_ENDED_CONTRACTS.includes(form.contract_type)

  const startEdit = () => {
    setForm({ staff_id: employee.staff_id ?? '', contract_type: employee.contract_type ?? '', employment_status: employee.employment_status ?? '', start_date: employee.start_date ?? '', end_date: employee.end_date ?? '' })
    setFieldErrors({}); setSaveError(null); setEditing(true)
  }

  const handleSave = async () => {
    const result = contractSchema.safeParse(form)
    if (!result.success) {
      const errs: ContractFieldErrors = {}
      for (const issue of result.error.issues) {
        const f = issue.path[0] as keyof ContractFieldErrors
        if (!errs[f]) errs[f] = issue.message
      }
      setFieldErrors(errs); return
    }
    setSaving(true); setSaveError(null)
    const r = await updateEmployeeCard(employeeId, 'contract', result.data)
    if (r.success) { setEditing(false); toast.success('Contract updated'); await onSaveSuccess() }
    else setSaveError(r.error)
    setSaving(false)
  }

  const fe = fieldErrors
  return (
    <CardShell title="Contract" editing={editing} saving={saving} saveError={saveError} onEdit={startEdit} onCancel={() => setEditing(false)} onSave={handleSave}>
      {editing ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <FL>Staff ID <span className="text-destructive">*</span></FL>
            <Input value={form.staff_id} onChange={(e) => s('staff_id')(e.target.value)} placeholder="e.g. EMP-001" className={cn(INPUT, fe.staff_id && 'border-destructive')} />
            {fe.staff_id && <p className="ml-1 text-xs text-destructive">{fe.staff_id}</p>}
          </div>
          <div className="space-y-1">
            <FL>Contract type <span className="text-destructive">*</span></FL>
            <select value={form.contract_type} onChange={(e) => handleContractTypeChange(e.target.value)} className={cn(SELECT, fe.contract_type && 'border-destructive')}>
              <option value="">Select…</option>
              {CONTRACT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {fe.contract_type && <p className="ml-1 text-xs text-destructive">{fe.contract_type}</p>}
          </div>
          <div className="space-y-1">
            <FL>Employment status <span className="text-destructive">*</span></FL>
            <select value={form.employment_status} onChange={(e) => s('employment_status')(e.target.value)} className={cn(SELECT, fe.employment_status && 'border-destructive')}>
              <option value="">Select…</option>
              {EMPLOYMENT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {fe.employment_status && <p className="ml-1 text-xs text-destructive">{fe.employment_status}</p>}
          </div>
          <div className="space-y-1">
            <FL>Start date <span className="text-destructive">*</span></FL>
            <Input type="date" value={form.start_date} onChange={(e) => s('start_date')(e.target.value)} className={cn(INPUT, fe.start_date && 'border-destructive')} />
            {fe.start_date && <p className="ml-1 text-xs text-destructive">{fe.start_date}</p>}
          </div>
          {!isOpenEnded && (
            <div className="space-y-1">
              <FL>End date <span className="text-destructive">*</span></FL>
              <Input type="date" value={form.end_date} onChange={(e) => s('end_date')(e.target.value)} className={cn(INPUT, fe.end_date && 'border-destructive')} />
              {fe.end_date && <p className="ml-1 text-xs text-destructive">{fe.end_date}</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldItem label="Staff ID" value={employee.staff_id} lastChange={historyByField.get('staff_id')} />
          <FieldItem label="Contract type" value={employee.contract_type} lastChange={historyByField.get('contract_type')} />
          <FieldItem label="Employment status" value={employee.employment_status} lastChange={historyByField.get('employment_status')} />
          <FieldItem label="Start date" value={fmtDate(employee.start_date)} lastChange={historyByField.get('start_date')} />
          <FieldItem label="End date" value={fmtDate(employee.end_date)} lastChange={historyByField.get('end_date')} />
        </div>
      )}
    </CardShell>
  )
}

// ─── PersonListSection ────────────────────────────────────────────────────────

type PersonForm = {
  title: string
  first_name: string
  last_name: string
  phone: string
  email: string
  relationship: string
  address: string
}

type PersonFieldErrors = Partial<Record<'first_name' | 'last_name' | 'phone' | 'email' | 'relationship', string>>

const personSchema = z.object({
  title: z.string().max(20, 'Too long'),
  first_name: z.string().min(1, 'First name is required').max(100, 'Too long'),
  last_name: z.string().min(1, 'Last name is required').max(100, 'Too long'),
  phone: z.string()
    .min(1, 'Phone number is required')
    .refine((v) => /^\+?[\d\s\-(). ]{7,20}$/.test(v), { message: 'Invalid phone number' }),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  relationship: z.string().min(1, 'Relationship is required').max(100, 'Too long'),
  address: z.string().max(255, 'Too long'),
})

function PersonFormFields({
  form,
  s,
  fieldErrors,
  onCancel,
  onSave,
  saving,
  saveError,
}: {
  form: PersonForm
  s: (k: string) => (v: string) => void
  fieldErrors: PersonFieldErrors
  onCancel: () => void
  onSave: () => void
  saving: boolean
  saveError: string | null
}) {
  const fe = fieldErrors
  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <FL>Title</FL>
          <Input value={form.title} onChange={(e) => s('title')(e.target.value)} placeholder="Mr / Mrs / Dr" className={INPUT} />
        </div>
        <div className="space-y-1">
          <FL>First name <span className="text-destructive">*</span></FL>
          <Input value={form.first_name} onChange={(e) => s('first_name')(e.target.value)} placeholder="First name" className={cn(INPUT, fe.first_name && 'border-destructive')} />
          {fe.first_name && <p className="ml-1 text-xs text-destructive">{fe.first_name}</p>}
        </div>
        <div className="space-y-1">
          <FL>Last name <span className="text-destructive">*</span></FL>
          <Input value={form.last_name} onChange={(e) => s('last_name')(e.target.value)} placeholder="Last name" className={cn(INPUT, fe.last_name && 'border-destructive')} />
          {fe.last_name && <p className="ml-1 text-xs text-destructive">{fe.last_name}</p>}
        </div>
        <div className="space-y-1">
          <FL>Phone <span className="text-destructive">*</span></FL>
          <Input value={form.phone} onChange={(e) => s('phone')(e.target.value)} placeholder="+234 800 000 0000" inputMode="tel" className={cn(INPUT, fe.phone && 'border-destructive')} />
          {fe.phone && <p className="ml-1 text-xs text-destructive">{fe.phone}</p>}
        </div>
        <div className="space-y-1">
          <FL>Email <span className="text-destructive">*</span></FL>
          <Input value={form.email} onChange={(e) => s('email')(e.target.value)} placeholder="email@example.com" inputMode="email" className={cn(INPUT, fe.email && 'border-destructive')} />
          {fe.email && <p className="ml-1 text-xs text-destructive">{fe.email}</p>}
        </div>
        <div className="space-y-1">
          <FL>Relationship <span className="text-destructive">*</span></FL>
          <Input value={form.relationship} onChange={(e) => s('relationship')(e.target.value)} placeholder="e.g. Spouse, Child, Sibling" className={cn(INPUT, fe.relationship && 'border-destructive')} />
          {fe.relationship && <p className="ml-1 text-xs text-destructive">{fe.relationship}</p>}
        </div>
        <div className="space-y-1 sm:col-span-2">
          <FL>Address</FL>
          <Input value={form.address} onChange={(e) => s('address')(e.target.value)} placeholder="Street address" className={INPUT} />
        </div>
      </div>
      {saveError && <p className="text-xs text-destructive">{saveError}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving} className="h-7 px-2 text-xs">Cancel</Button>
        <Button size="sm" onClick={onSave} disabled={saving} className="h-7 px-2 text-xs gap-1">
          {saving ? <Loader2Icon className="size-3 animate-spin" /> : null} Save
        </Button>
      </div>
    </div>
  )
}

function PersonCard({
  rec,
  onEdit,
  onDelete,
}: {
  rec: Employee360Person
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              {rec.title ? `${rec.title} ` : ''}{rec.first_name} {rec.last_name}
            </p>
            <p className="text-xs text-muted-foreground truncate">{rec.relationship}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="size-7" onClick={onEdit}><PencilIcon className="size-3" /></Button>
          <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={onDelete}><Trash2Icon className="size-3" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-1 border-t">
        <FieldItem label="Phone" value={rec.phone} />
        <FieldItem label="Email" value={rec.email} />
        {rec.address && <FieldItem label="Address" value={rec.address} />}
      </div>
    </div>
  )
}

function PersonListSection({
  employeeId,
  table,
  title,
  records,
  onSaveSuccess,
  maxRecords,
}: {
  employeeId: string
  table: MultiRowTable
  title: string
  records: Employee360Person[]
  onSaveSuccess: () => Promise<void>
  maxRecords?: number
}) {
  const emptyForm: PersonForm = { title: '', first_name: '', last_name: '', phone: '', email: '', relationship: '', address: '' }
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<PersonForm>(emptyForm)
  const [fieldErrors, setFieldErrors] = useState<PersonFieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const s = (k: string) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setFieldErrors((p) => ({ ...p, [k]: undefined }))
  }

  const validate = () => {
    const result = personSchema.safeParse(form)
    if (result.success) { setFieldErrors({}); return true }
    const errs: PersonFieldErrors = {}
    for (const issue of result.error.issues) {
      const f = issue.path[0] as keyof PersonFieldErrors
      if (!errs[f]) errs[f] = issue.message
    }
    setFieldErrors(errs)
    return false
  }

  const handleAdd = async () => {
    if (!validate()) return
    setSaving(true); setSaveError(null)
    const r = await addEmployeeRecord(employeeId, table, form)
    if (r.success) { setAdding(false); setForm(emptyForm); setFieldErrors({}); toast.success(`${title} record added`); await onSaveSuccess() }
    else setSaveError(r.error)
    setSaving(false)
  }

  const handleUpdate = async (recordId: string) => {
    if (!validate()) return
    setSaving(true); setSaveError(null)
    const r = await updateEmployeeRecord(employeeId, table, recordId, form)
    if (r.success) { setEditingId(null); setFieldErrors({}); toast.success(`${title} record updated`); await onSaveSuccess() }
    else setSaveError(r.error)
    setSaving(false)
  }

  const handleDelete = async (recordId: string) => {
    const r = await deleteEmployeeRecord(employeeId, table, recordId)
    if (r.success) { toast.success(`${title} record removed`); await onSaveSuccess() }
    else toast.error(r.error)
  }

  const atMax = maxRecords !== undefined && records.length >= maxRecords

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          {maxRecords !== undefined && (
            <span className="text-xs text-muted-foreground">({records.length}/{maxRecords})</span>
          )}
        </div>
        {!atMax && (
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
            onClick={() => { setForm(emptyForm); setFieldErrors({}); setSaveError(null); setAdding(true) }}
          >
            <PlusIcon className="size-3" /> Add
          </Button>
        )}
      </div>

      {atMax && !adding && (
        <p className="text-xs text-muted-foreground">Maximum of {maxRecords} {title.toLowerCase()} records reached.</p>
      )}

      {adding && (
        <PersonFormFields form={form} s={s} fieldErrors={fieldErrors} onCancel={() => { setAdding(false); setFieldErrors({}) }} onSave={handleAdd} saving={saving} saveError={saveError} />
      )}

      {records.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">No records yet.</p>
      )}

      {records.map((rec) =>
        editingId === rec.id ? (
          <PersonFormFields
            key={rec.id}
            form={form}
            s={s}
            fieldErrors={fieldErrors}
            onCancel={() => { setEditingId(null); setFieldErrors({}) }}
            onSave={() => handleUpdate(rec.id)}
            saving={saving}
            saveError={saveError}
          />
        ) : (
          <PersonCard
            key={rec.id}
            rec={rec}
            onEdit={() => {
              setForm({ title: rec.title ?? '', first_name: rec.first_name, last_name: rec.last_name, phone: rec.phone, email: rec.email ?? '', relationship: rec.relationship, address: rec.address })
              setFieldErrors({}); setSaveError(null); setEditingId(rec.id)
            }}
            onDelete={() => handleDelete(rec.id)}
          />
        )
      )}
    </div>
  )
}

// ─── NextOfKinSection ─────────────────────────────────────────────────────────

const NOK_PURPOSE_OPTIONS = [
  { value: 'emergency', label: 'Emergency' },
  { value: 'benefit', label: 'Benefit' },
  { value: 'emergency_and_benefit', label: 'Emergency & Benefit' },
]

const MAX_NEXT_OF_KIN = 3

type NextOfKinForm = PersonForm & { purpose: string }

type NokFieldErrors = Partial<Record<'first_name' | 'last_name' | 'phone' | 'email' | 'relationship', string>>

const nokSchema = z.object({
  title: z.string().max(20, 'Too long'),
  first_name: z.string().min(1, 'First name is required').max(100, 'Too long'),
  last_name: z.string().min(1, 'Last name is required').max(100, 'Too long'),
  phone: z.string()
    .min(1, 'Phone number is required')
    .refine((v) => /^\+?[\d\s\-(). ]{7,20}$/.test(v), { message: 'Invalid phone number' }),
  email: z.string()
    .min(1, 'Email is required')
    .email('Invalid email address'),
  relationship: z.string().min(1, 'Relationship is required').max(100, 'Too long'),
  address: z.string().max(255, 'Too long'),
  purpose: z.string().min(1, 'Purpose is required'),
})

function NextOfKinFormFields({
  form,
  s,
  fieldErrors,
  onCancel,
  onSave,
  saving,
  saveError,
}: {
  form: NextOfKinForm
  s: (k: string) => (v: string) => void
  fieldErrors: NokFieldErrors
  onCancel: () => void
  onSave: () => void
  saving: boolean
  saveError: string | null
}) {
  const fe = fieldErrors
  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <FL>Title</FL>
          <Input value={form.title} onChange={(e) => s('title')(e.target.value)} placeholder="Mr / Mrs / Dr" className={INPUT} />
        </div>
        <div className="space-y-1">
          <FL>First name <span className="text-destructive">*</span></FL>
          <Input value={form.first_name} onChange={(e) => s('first_name')(e.target.value)} placeholder="First name" className={cn(INPUT, fe.first_name && 'border-destructive')} />
          {fe.first_name && <p className="ml-1 text-xs text-destructive">{fe.first_name}</p>}
        </div>
        <div className="space-y-1">
          <FL>Last name <span className="text-destructive">*</span></FL>
          <Input value={form.last_name} onChange={(e) => s('last_name')(e.target.value)} placeholder="Last name" className={cn(INPUT, fe.last_name && 'border-destructive')} />
          {fe.last_name && <p className="ml-1 text-xs text-destructive">{fe.last_name}</p>}
        </div>
        <div className="space-y-1">
          <FL>Phone <span className="text-destructive">*</span></FL>
          <Input value={form.phone} onChange={(e) => s('phone')(e.target.value)} placeholder="+234 800 000 0000" inputMode="tel" className={cn(INPUT, fe.phone && 'border-destructive')} />
          {fe.phone && <p className="ml-1 text-xs text-destructive">{fe.phone}</p>}
        </div>
        <div className="space-y-1">
          <FL>Email <span className="text-destructive">*</span></FL>
          <Input value={form.email} onChange={(e) => s('email')(e.target.value)} placeholder="email@example.com" inputMode="email" className={cn(INPUT, fe.email && 'border-destructive')} />
          {fe.email && <p className="ml-1 text-xs text-destructive">{fe.email}</p>}
        </div>
        <div className="space-y-1">
          <FL>Relationship <span className="text-destructive">*</span></FL>
          <Input value={form.relationship} onChange={(e) => s('relationship')(e.target.value)} placeholder="e.g. Spouse, Child, Sibling" className={cn(INPUT, fe.relationship && 'border-destructive')} />
          {fe.relationship && <p className="ml-1 text-xs text-destructive">{fe.relationship}</p>}
        </div>
        <div className="space-y-1">
          <FL>Purpose</FL>
          <select value={form.purpose} onChange={(e) => s('purpose')(e.target.value)} className={SELECT}>
            {NOK_PURPOSE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <FL>Address</FL>
          <Input value={form.address} onChange={(e) => s('address')(e.target.value)} placeholder="Street address" className={INPUT} />
        </div>
      </div>
      {saveError && <p className="text-xs text-destructive">{saveError}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving} className="h-7 px-2 text-xs">Cancel</Button>
        <Button size="sm" onClick={onSave} disabled={saving} className="h-7 px-2 text-xs gap-1">
          {saving ? <Loader2Icon className="size-3 animate-spin" /> : null} Save
        </Button>
      </div>
    </div>
  )
}

function NextOfKinCard({
  rec,
  purposeLabel,
  onEdit,
  onDelete,
}: {
  rec: Employee360Person
  purposeLabel: (v: string | null | undefined) => string
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              {rec.title ? `${rec.title} ` : ''}{rec.first_name} {rec.last_name}
            </p>
            <p className="text-xs text-muted-foreground truncate">{rec.relationship}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="size-7" onClick={onEdit}><PencilIcon className="size-3" /></Button>
          <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={onDelete}><Trash2Icon className="size-3" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-1 border-t">
        <FieldItem label="Phone" value={rec.phone} />
        <FieldItem label="Email" value={rec.email} />
        <FieldItem label="Purpose" value={purposeLabel(rec.purpose)} />
        <FieldItem label="Address" value={rec.address} />
      </div>
    </div>
  )
}

function NextOfKinSection({
  employeeId,
  records,
  onSaveSuccess,
}: {
  employeeId: string
  records: Employee360Person[]
  onSaveSuccess: () => Promise<void>
}) {
  const emptyForm: NextOfKinForm = { title: '', first_name: '', last_name: '', phone: '', email: '', relationship: '', address: '', purpose: 'emergency' }
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<NextOfKinForm>(emptyForm)
  const [fieldErrors, setFieldErrors] = useState<NokFieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const s = (k: string) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setFieldErrors((p) => ({ ...p, [k]: undefined }))
  }

  const validate = () => {
    const result = nokSchema.safeParse(form)
    if (result.success) { setFieldErrors({}); return true }
    const errs: NokFieldErrors = {}
    for (const issue of result.error.issues) {
      const f = issue.path[0] as keyof NokFieldErrors
      if (!errs[f]) errs[f] = issue.message
    }
    setFieldErrors(errs)
    return false
  }

  const handleAdd = async () => {
    if (!validate()) return
    setSaving(true); setSaveError(null)
    const r = await addEmployeeRecord(employeeId, 'employee_next_of_kin', form)
    if (r.success) { setAdding(false); setForm(emptyForm); setFieldErrors({}); toast.success('Next of kin added'); await onSaveSuccess() }
    else setSaveError(r.error)
    setSaving(false)
  }

  const handleUpdate = async (recordId: string) => {
    if (!validate()) return
    setSaving(true); setSaveError(null)
    const r = await updateEmployeeRecord(employeeId, 'employee_next_of_kin', recordId, form)
    if (r.success) { setEditingId(null); setFieldErrors({}); toast.success('Next of kin updated'); await onSaveSuccess() }
    else setSaveError(r.error)
    setSaving(false)
  }

  const handleDelete = async (recordId: string) => {
    const r = await deleteEmployeeRecord(employeeId, 'employee_next_of_kin', recordId)
    if (r.success) { toast.success('Next of kin removed'); await onSaveSuccess() }
    else toast.error(r.error)
  }

  const purposeLabel = (v: string | null | undefined) =>
    NOK_PURPOSE_OPTIONS.find((o) => o.value === v)?.label ?? v ?? '—'

  const atMax = records.length >= MAX_NEXT_OF_KIN

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Next of Kin</h3>
          <span className="text-xs text-muted-foreground">({records.length}/{MAX_NEXT_OF_KIN})</span>
        </div>
        {!atMax && (
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
            onClick={() => { setForm(emptyForm); setFieldErrors({}); setSaveError(null); setAdding(true) }}
          >
            <PlusIcon className="size-3" /> Add
          </Button>
        )}
      </div>

      {atMax && !adding && (
        <p className="text-xs text-muted-foreground">Maximum of {MAX_NEXT_OF_KIN} next of kin reached.</p>
      )}

      {adding && (
        <NextOfKinFormFields form={form} s={s} fieldErrors={fieldErrors} onCancel={() => { setAdding(false); setFieldErrors({}) }} onSave={handleAdd} saving={saving} saveError={saveError} />
      )}

      {records.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">No records yet.</p>
      )}

      {records.map((rec) =>
        editingId === rec.id ? (
          <NextOfKinFormFields
            key={rec.id}
            form={form}
            s={s}
            fieldErrors={fieldErrors}
            onCancel={() => { setEditingId(null); setFieldErrors({}) }}
            onSave={() => handleUpdate(rec.id)}
            saving={saving}
            saveError={saveError}
          />
        ) : (
          <NextOfKinCard
            key={rec.id}
            rec={rec}
            purposeLabel={purposeLabel}
            onEdit={() => {
              setForm({ title: rec.title ?? '', first_name: rec.first_name, last_name: rec.last_name, phone: rec.phone, email: rec.email ?? '', relationship: rec.relationship, address: rec.address, purpose: rec.purpose ?? 'emergency' })
              setFieldErrors({}); setSaveError(null); setEditingId(rec.id)
            }}
            onDelete={() => handleDelete(rec.id)}
          />
        )
      )}
    </div>
  )
}

// ─── ExperienceSection ────────────────────────────────────────────────────────

type ExperienceForm = {
  company: string; position: string; address: string; phone: string
  email: string; reason_for_leaving: string; start_date: string; end_date: string
}
type ExpFieldErrors = Partial<Record<'company' | 'position' | 'start_date', string>>

const experienceSchema = z.object({
  company: z.string().min(1, 'Company name is required').max(150, 'Too long'),
  position: z.string().min(1, 'Position is required').max(150, 'Too long'),
  address: z.string().max(255, 'Too long'),
  phone: z.string().max(20, 'Too long'),
  email: z.string().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'Invalid email' }),
  reason_for_leaving: z.string().max(500, 'Too long'),
  start_date: z.string().min(1, 'Start date is required').refine((v) => !isNaN(new Date(v).getTime()), { message: 'Invalid date' }),
  end_date: z.string().refine((v) => !v || !isNaN(new Date(v).getTime()), { message: 'Invalid date' }),
}).refine(
  (d) => !d.end_date || !d.start_date || new Date(d.end_date) >= new Date(d.start_date),
  { message: 'End date must not be before start date', path: ['end_date'] }
)

function ExperienceFormFields({ form, s, fieldErrors, onCancel, onSave, saving, saveError }: {
  form: ExperienceForm; s: (k: string) => (v: string) => void; fieldErrors: ExpFieldErrors
  onCancel: () => void; onSave: () => void; saving: boolean; saveError: string | null
}) {
  const fe = fieldErrors
  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <FL>Company <span className="text-destructive">*</span></FL>
          <Input value={form.company} onChange={(e) => s('company')(e.target.value)} placeholder="Company name" className={cn(INPUT, fe.company && 'border-destructive')} />
          {fe.company && <p className="ml-1 text-xs text-destructive">{fe.company}</p>}
        </div>
        <div className="space-y-1">
          <FL>Position / Title <span className="text-destructive">*</span></FL>
          <Input value={form.position} onChange={(e) => s('position')(e.target.value)} placeholder="Job title" className={cn(INPUT, fe.position && 'border-destructive')} />
          {fe.position && <p className="ml-1 text-xs text-destructive">{fe.position}</p>}
        </div>
        <div className="space-y-1">
          <FL>Company phone</FL>
          <Input value={form.phone} onChange={(e) => s('phone')(e.target.value)} placeholder="+234 800 000 0000" className={INPUT} />
        </div>
        <div className="space-y-1">
          <FL>Company email</FL>
          <Input value={form.email} onChange={(e) => s('email')(e.target.value)} placeholder="hr@company.com" className={INPUT} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <FL>Company address</FL>
          <Input value={form.address} onChange={(e) => s('address')(e.target.value)} placeholder="Street address" className={INPUT} />
        </div>
        <div className="space-y-1">
          <FL>Start date <span className="text-destructive">*</span></FL>
          <Input type="date" value={form.start_date} onChange={(e) => s('start_date')(e.target.value)} className={cn(INPUT, fe.start_date && 'border-destructive')} />
          {fe.start_date && <p className="ml-1 text-xs text-destructive">{fe.start_date}</p>}
        </div>
        <div className="space-y-1">
          <FL>End date</FL>
          <Input type="date" value={form.end_date} onChange={(e) => s('end_date')(e.target.value)} className={INPUT} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <FL>Reason for leaving</FL>
          <Input value={form.reason_for_leaving} onChange={(e) => s('reason_for_leaving')(e.target.value)} placeholder="Optional" className={INPUT} />
        </div>
      </div>
      {saveError && <p className="text-xs text-destructive">{saveError}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving} className="h-7 px-2 text-xs">Cancel</Button>
        <Button size="sm" onClick={onSave} disabled={saving} className="h-7 px-2 text-xs gap-1">
          {saving ? <Loader2Icon className="size-3 animate-spin" /> : null} Save
        </Button>
      </div>
    </div>
  )
}

function ExperienceCard({ rec, onEdit, onDelete }: { rec: Employee360Experience; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{rec.company}</p>
          <p className="text-xs text-muted-foreground truncate">{rec.position}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fmtDate(rec.start_date)} – {rec.end_date ? fmtDate(rec.end_date) : 'Present'}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="size-7" onClick={onEdit}><PencilIcon className="size-3" /></Button>
          <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={onDelete}><Trash2Icon className="size-3" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-1 border-t">
        {rec.phone && <FieldItem label="Company phone" value={rec.phone} />}
        {rec.email && <FieldItem label="Company email" value={rec.email} />}
        {rec.address && <FieldItem label="Company address" value={rec.address} />}
        {rec.reason_for_leaving && <FieldItem label="Reason for leaving" value={rec.reason_for_leaving} />}
      </div>
    </div>
  )
}

function ExperienceSection({ employeeId, records, onSaveSuccess }: {
  employeeId: string; records: Employee360Experience[]; onSaveSuccess: () => Promise<void>
}) {
  const empty: ExperienceForm = { company: '', position: '', address: '', phone: '', email: '', reason_for_leaving: '', start_date: '', end_date: '' }
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ExperienceForm>(empty)
  const [fieldErrors, setFieldErrors] = useState<ExpFieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const s = (k: string) => (v: string) => { setForm((p) => ({ ...p, [k]: v })); setFieldErrors((p) => ({ ...p, [k]: undefined })) }

  const validate = () => {
    const result = experienceSchema.safeParse(form)
    if (result.success) { setFieldErrors({}); return true }
    const errs: ExpFieldErrors = {}
    for (const issue of result.error.issues) { const f = issue.path[0] as keyof ExpFieldErrors; if (!errs[f]) errs[f] = issue.message }
    setFieldErrors(errs); return false
  }

  const handleAdd = async () => {
    if (!validate()) return
    setSaving(true); setSaveError(null)
    const r = await addEmployeeRecord(employeeId, 'employee_experience', form)
    if (r.success) { setAdding(false); setForm(empty); setFieldErrors({}); toast.success('Experience added'); await onSaveSuccess() }
    else setSaveError(r.error)
    setSaving(false)
  }

  const handleUpdate = async (id: string) => {
    if (!validate()) return
    setSaving(true); setSaveError(null)
    const r = await updateEmployeeRecord(employeeId, 'employee_experience', id, form)
    if (r.success) { setEditingId(null); setFieldErrors({}); toast.success('Experience updated'); await onSaveSuccess() }
    else setSaveError(r.error)
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const r = await deleteEmployeeRecord(employeeId, 'employee_experience', id)
    if (r.success) { toast.success('Experience removed'); await onSaveSuccess() }
    else toast.error(r.error)
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <SectionHeader title="Work Experience" onAdd={() => { setForm(empty); setFieldErrors({}); setSaveError(null); setAdding(true) }} />
      {adding && <ExperienceFormFields form={form} s={s} fieldErrors={fieldErrors} onCancel={() => { setAdding(false); setFieldErrors({}) }} onSave={handleAdd} saving={saving} saveError={saveError} />}
      {records.length === 0 && !adding && <p className="text-xs text-muted-foreground">No experience records yet.</p>}
      {records.map((rec) =>
        editingId === rec.id ? (
          <ExperienceFormFields key={rec.id} form={form} s={s} fieldErrors={fieldErrors} onCancel={() => { setEditingId(null); setFieldErrors({}) }} onSave={() => handleUpdate(rec.id)} saving={saving} saveError={saveError} />
        ) : (
          <ExperienceCard key={rec.id} rec={rec}
            onEdit={() => { setForm({ company: rec.company, position: rec.position, address: rec.address, phone: rec.phone ?? '', email: rec.email ?? '', reason_for_leaving: rec.reason_for_leaving ?? '', start_date: rec.start_date ?? '', end_date: rec.end_date ?? '' }); setFieldErrors({}); setSaveError(null); setEditingId(rec.id) }}
            onDelete={() => handleDelete(rec.id)}
          />
        )
      )}
    </div>
  )
}

// ─── EducationSection ─────────────────────────────────────────────────────────

type EducationForm = { school: string; course: string; degree: string; grade: string; start_date: string; end_date: string }
type EduFieldErrors = Partial<Record<'school' | 'course' | 'degree' | 'start_date', string>>

const educationSchema = z.object({
  school: z.string().min(1, 'School name is required').max(150, 'Too long'),
  course: z.string().min(1, 'Course / field of study is required').max(150, 'Too long'),
  degree: z.string().min(1, 'Degree / qualification is required').max(100, 'Too long'),
  grade: z.string().max(50, 'Too long'),
  start_date: z.string().min(1, 'Start date is required').refine((v) => !isNaN(new Date(v).getTime()), { message: 'Invalid date' }),
  end_date: z.string().refine((v) => !v || !isNaN(new Date(v).getTime()), { message: 'Invalid date' }),
}).refine(
  (d) => !d.end_date || !d.start_date || new Date(d.end_date) >= new Date(d.start_date),
  { message: 'End date must not be before start date', path: ['end_date'] }
)

function EducationFormFields({ form, s, fieldErrors, onCancel, onSave, saving, saveError }: {
  form: EducationForm; s: (k: string) => (v: string) => void; fieldErrors: EduFieldErrors
  onCancel: () => void; onSave: () => void; saving: boolean; saveError: string | null
}) {
  const fe = fieldErrors
  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <FL>School / Institution <span className="text-destructive">*</span></FL>
          <Input value={form.school} onChange={(e) => s('school')(e.target.value)} placeholder="University / polytechnic" className={cn(INPUT, fe.school && 'border-destructive')} />
          {fe.school && <p className="ml-1 text-xs text-destructive">{fe.school}</p>}
        </div>
        <div className="space-y-1">
          <FL>Course / Field of study <span className="text-destructive">*</span></FL>
          <Input value={form.course} onChange={(e) => s('course')(e.target.value)} placeholder="e.g. Computer Science" className={cn(INPUT, fe.course && 'border-destructive')} />
          {fe.course && <p className="ml-1 text-xs text-destructive">{fe.course}</p>}
        </div>
        <div className="space-y-1">
          <FL>Degree / Qualification <span className="text-destructive">*</span></FL>
          <Input value={form.degree} onChange={(e) => s('degree')(e.target.value)} placeholder="B.Sc, OND, HND…" className={cn(INPUT, fe.degree && 'border-destructive')} />
          {fe.degree && <p className="ml-1 text-xs text-destructive">{fe.degree}</p>}
        </div>
        <div className="space-y-1">
          <FL>Grade / Class</FL>
          <Input value={form.grade} onChange={(e) => s('grade')(e.target.value)} placeholder="e.g. First Class" className={INPUT} />
        </div>
        <div className="space-y-1">
          <FL>Start date <span className="text-destructive">*</span></FL>
          <Input type="date" value={form.start_date} onChange={(e) => s('start_date')(e.target.value)} className={cn(INPUT, fe.start_date && 'border-destructive')} />
          {fe.start_date && <p className="ml-1 text-xs text-destructive">{fe.start_date}</p>}
        </div>
        <div className="space-y-1">
          <FL>End date (graduation)</FL>
          <Input type="date" value={form.end_date} onChange={(e) => s('end_date')(e.target.value)} className={INPUT} />
        </div>
      </div>
      {saveError && <p className="text-xs text-destructive">{saveError}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving} className="h-7 px-2 text-xs">Cancel</Button>
        <Button size="sm" onClick={onSave} disabled={saving} className="h-7 px-2 text-xs gap-1">
          {saving ? <Loader2Icon className="size-3 animate-spin" /> : null} Save
        </Button>
      </div>
    </div>
  )
}

function EducationCard({ rec, onEdit, onDelete }: { rec: Employee360Education; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{rec.school}</p>
          <p className="text-xs text-muted-foreground truncate">{rec.degree}{rec.course ? ` · ${rec.course}` : ''}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fmtDate(rec.start_date)} – {rec.end_date ? fmtDate(rec.end_date) : 'Present'}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="size-7" onClick={onEdit}><PencilIcon className="size-3" /></Button>
          <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={onDelete}><Trash2Icon className="size-3" /></Button>
        </div>
      </div>
      {rec.grade && (
        <div className="pt-1 border-t">
          <FieldItem label="Grade / Class" value={rec.grade} />
        </div>
      )}
    </div>
  )
}

function EducationSection({ employeeId, records, onSaveSuccess }: {
  employeeId: string; records: Employee360Education[]; onSaveSuccess: () => Promise<void>
}) {
  const empty: EducationForm = { school: '', course: '', degree: '', grade: '', start_date: '', end_date: '' }
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EducationForm>(empty)
  const [fieldErrors, setFieldErrors] = useState<EduFieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const s = (k: string) => (v: string) => { setForm((p) => ({ ...p, [k]: v })); setFieldErrors((p) => ({ ...p, [k]: undefined })) }

  const validate = () => {
    const result = educationSchema.safeParse(form)
    if (result.success) { setFieldErrors({}); return true }
    const errs: EduFieldErrors = {}
    for (const issue of result.error.issues) { const f = issue.path[0] as keyof EduFieldErrors; if (!errs[f]) errs[f] = issue.message }
    setFieldErrors(errs); return false
  }

  const handleAdd = async () => {
    if (!validate()) return
    setSaving(true); setSaveError(null)
    const r = await addEmployeeRecord(employeeId, 'employee_education', form)
    if (r.success) { setAdding(false); setForm(empty); setFieldErrors({}); toast.success('Education added'); await onSaveSuccess() }
    else setSaveError(r.error)
    setSaving(false)
  }

  const handleUpdate = async (id: string) => {
    if (!validate()) return
    setSaving(true); setSaveError(null)
    const r = await updateEmployeeRecord(employeeId, 'employee_education', id, form)
    if (r.success) { setEditingId(null); setFieldErrors({}); toast.success('Education updated'); await onSaveSuccess() }
    else setSaveError(r.error)
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const r = await deleteEmployeeRecord(employeeId, 'employee_education', id)
    if (r.success) { toast.success('Education removed'); await onSaveSuccess() }
    else toast.error(r.error)
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <SectionHeader title="Education" onAdd={() => { setForm(empty); setFieldErrors({}); setSaveError(null); setAdding(true) }} />
      {adding && <EducationFormFields form={form} s={s} fieldErrors={fieldErrors} onCancel={() => { setAdding(false); setFieldErrors({}) }} onSave={handleAdd} saving={saving} saveError={saveError} />}
      {records.length === 0 && !adding && <p className="text-xs text-muted-foreground">No education records yet.</p>}
      {records.map((rec) =>
        editingId === rec.id ? (
          <EducationFormFields key={rec.id} form={form} s={s} fieldErrors={fieldErrors} onCancel={() => { setEditingId(null); setFieldErrors({}) }} onSave={() => handleUpdate(rec.id)} saving={saving} saveError={saveError} />
        ) : (
          <EducationCard key={rec.id} rec={rec}
            onEdit={() => { setForm({ school: rec.school, course: rec.course, degree: rec.degree, grade: rec.grade ?? '', start_date: rec.start_date ?? '', end_date: rec.end_date ?? '' }); setFieldErrors({}); setSaveError(null); setEditingId(rec.id) }}
            onDelete={() => handleDelete(rec.id)}
          />
        )
      )}
    </div>
  )
}

// ─── TrainingSection ──────────────────────────────────────────────────────────

type TrainingForm = { institution: string; course: string; license_name: string; issuing_body: string; start_date: string; end_date: string }
type TrainingFieldErrors = Partial<Record<'institution' | 'course' | 'start_date', string>>

const trainingSchema = z.object({
  institution: z.string().min(1, 'Institution is required').max(150, 'Too long'),
  course: z.string().min(1, 'Course / training name is required').max(150, 'Too long'),
  license_name: z.string().max(150, 'Too long'),
  issuing_body: z.string().max(150, 'Too long'),
  start_date: z.string().min(1, 'Start date is required').refine((v) => !isNaN(new Date(v).getTime()), { message: 'Invalid date' }),
  end_date: z.string().refine((v) => !v || !isNaN(new Date(v).getTime()), { message: 'Invalid date' }),
}).refine(
  (d) => !d.end_date || !d.start_date || new Date(d.end_date) >= new Date(d.start_date),
  { message: 'Expiry date must not be before start date', path: ['end_date'] }
)

function TrainingFormFields({ form, s, fieldErrors, onCancel, onSave, saving, saveError }: {
  form: TrainingForm; s: (k: string) => (v: string) => void; fieldErrors: TrainingFieldErrors
  onCancel: () => void; onSave: () => void; saving: boolean; saveError: string | null
}) {
  const fe = fieldErrors
  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <FL>Institution <span className="text-destructive">*</span></FL>
          <Input value={form.institution} onChange={(e) => s('institution')(e.target.value)} placeholder="Training provider / institution" className={cn(INPUT, fe.institution && 'border-destructive')} />
          {fe.institution && <p className="ml-1 text-xs text-destructive">{fe.institution}</p>}
        </div>
        <div className="space-y-1">
          <FL>Course / Training <span className="text-destructive">*</span></FL>
          <Input value={form.course} onChange={(e) => s('course')(e.target.value)} placeholder="e.g. First Aid, PMP" className={cn(INPUT, fe.course && 'border-destructive')} />
          {fe.course && <p className="ml-1 text-xs text-destructive">{fe.course}</p>}
        </div>
        <div className="space-y-1">
          <FL>Licence / Certificate name</FL>
          <Input value={form.license_name} onChange={(e) => s('license_name')(e.target.value)} placeholder="Optional" className={INPUT} />
        </div>
        <div className="space-y-1">
          <FL>Issuing body</FL>
          <Input value={form.issuing_body} onChange={(e) => s('issuing_body')(e.target.value)} placeholder="Optional" className={INPUT} />
        </div>
        <div className="space-y-1">
          <FL>Start date <span className="text-destructive">*</span></FL>
          <Input type="date" value={form.start_date} onChange={(e) => s('start_date')(e.target.value)} className={cn(INPUT, fe.start_date && 'border-destructive')} />
          {fe.start_date && <p className="ml-1 text-xs text-destructive">{fe.start_date}</p>}
        </div>
        <div className="space-y-1">
          <FL>Expiry / End date</FL>
          <Input type="date" value={form.end_date} onChange={(e) => s('end_date')(e.target.value)} className={INPUT} />
        </div>
      </div>
      {saveError && <p className="text-xs text-destructive">{saveError}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving} className="h-7 px-2 text-xs">Cancel</Button>
        <Button size="sm" onClick={onSave} disabled={saving} className="h-7 px-2 text-xs gap-1">
          {saving ? <Loader2Icon className="size-3 animate-spin" /> : null} Save
        </Button>
      </div>
    </div>
  )
}

function TrainingCard({ rec, onEdit, onDelete }: { rec: Employee360Training; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{rec.course}</p>
          <p className="text-xs text-muted-foreground truncate">{rec.institution}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fmtDate(rec.start_date)} – {rec.end_date ? fmtDate(rec.end_date) : 'No expiry'}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="size-7" onClick={onEdit}><PencilIcon className="size-3" /></Button>
          <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={onDelete}><Trash2Icon className="size-3" /></Button>
        </div>
      </div>
      {(rec.license_name || rec.issuing_body) && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-1 border-t">
          {rec.license_name && <FieldItem label="Licence / Certificate" value={rec.license_name} />}
          {rec.issuing_body && <FieldItem label="Issuing body" value={rec.issuing_body} />}
        </div>
      )}
    </div>
  )
}

function TrainingSection({ employeeId, records, onSaveSuccess }: {
  employeeId: string; records: Employee360Training[]; onSaveSuccess: () => Promise<void>
}) {
  const empty: TrainingForm = { institution: '', course: '', license_name: '', issuing_body: '', start_date: '', end_date: '' }
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TrainingForm>(empty)
  const [fieldErrors, setFieldErrors] = useState<TrainingFieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const s = (k: string) => (v: string) => { setForm((p) => ({ ...p, [k]: v })); setFieldErrors((p) => ({ ...p, [k]: undefined })) }

  const validate = () => {
    const result = trainingSchema.safeParse(form)
    if (result.success) { setFieldErrors({}); return true }
    const errs: TrainingFieldErrors = {}
    for (const issue of result.error.issues) { const f = issue.path[0] as keyof TrainingFieldErrors; if (!errs[f]) errs[f] = issue.message }
    setFieldErrors(errs); return false
  }

  const handleAdd = async () => {
    if (!validate()) return
    setSaving(true); setSaveError(null)
    const r = await addEmployeeRecord(employeeId, 'employee_training', form)
    if (r.success) { setAdding(false); setForm(empty); setFieldErrors({}); toast.success('Training added'); await onSaveSuccess() }
    else setSaveError(r.error)
    setSaving(false)
  }

  const handleUpdate = async (id: string) => {
    if (!validate()) return
    setSaving(true); setSaveError(null)
    const r = await updateEmployeeRecord(employeeId, 'employee_training', id, form)
    if (r.success) { setEditingId(null); setFieldErrors({}); toast.success('Training updated'); await onSaveSuccess() }
    else setSaveError(r.error)
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const r = await deleteEmployeeRecord(employeeId, 'employee_training', id)
    if (r.success) { toast.success('Training removed'); await onSaveSuccess() }
    else toast.error(r.error)
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <SectionHeader title="Training & Certifications" onAdd={() => { setForm(empty); setFieldErrors({}); setSaveError(null); setAdding(true) }} />
      {adding && <TrainingFormFields form={form} s={s} fieldErrors={fieldErrors} onCancel={() => { setAdding(false); setFieldErrors({}) }} onSave={handleAdd} saving={saving} saveError={saveError} />}
      {records.length === 0 && !adding && <p className="text-xs text-muted-foreground">No training records yet.</p>}
      {records.map((rec) =>
        editingId === rec.id ? (
          <TrainingFormFields key={rec.id} form={form} s={s} fieldErrors={fieldErrors} onCancel={() => { setEditingId(null); setFieldErrors({}) }} onSave={() => handleUpdate(rec.id)} saving={saving} saveError={saveError} />
        ) : (
          <TrainingCard key={rec.id} rec={rec}
            onEdit={() => { setForm({ institution: rec.institution, course: rec.course, license_name: rec.license_name ?? '', issuing_body: rec.issuing_body ?? '', start_date: rec.start_date ?? '', end_date: rec.end_date ?? '' }); setFieldErrors({}); setSaveError(null); setEditingId(rec.id) }}
            onDelete={() => handleDelete(rec.id)}
          />
        )
      )}
    </div>
  )
}

// ─── BankDetailsCard ──────────────────────────────────────────────────────────

const bankDetailsSchema = z.object({
  bank_name: z.string().max(100, 'Too long'),
  account_name: z.string(),
  account_number: z.string()
    .regex(/^\d{10}$/, 'Account number must be exactly 10 digits'),
  account_type: z.string(),
  bvn: z.string().refine(
    (v) => !v || /^\d{11}$/.test(v),
    { message: 'BVN must be exactly 11 digits' }
  ),
  nin: z.string().refine(
    (v) => !v || /^\d{11}$/.test(v),
    { message: 'NIN must be exactly 11 digits' }
  ),
  pfa: z.string().max(150, 'Too long'),
  rsa_pin: z.string().max(50, 'Too long'),
  tax_id: z.string().max(50, 'Too long'),
  nhf_id: z.string().max(50, 'Too long'),
})
type BankDetailsFieldErrors = Partial<Record<keyof z.infer<typeof bankDetailsSchema>, string>>

function BankDetailsCard({
  employeeId,
  bankDetails,
  onSaveSuccess,
}: {
  employeeId: string
  bankDetails: Employee360BankDetails | null
  onSaveSuccess: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const emptyForm = { bank_name: '', account_name: '', account_number: '', account_type: '', bvn: '', nin: '', pfa: '', rsa_pin: '', tax_id: '', nhf_id: '' }
  const fromDetails = () => bankDetails
    ? { bank_name: bankDetails.bank_name ?? '', account_name: bankDetails.account_name ?? '', account_number: bankDetails.account_number ?? '', account_type: bankDetails.account_type ?? '', bvn: bankDetails.bvn ?? '', nin: bankDetails.nin ?? '', pfa: bankDetails.pfa ?? '', rsa_pin: bankDetails.rsa_pin ?? '', tax_id: bankDetails.tax_id ?? '', nhf_id: bankDetails.nhf_id ?? '' }
    : emptyForm
  const [form, setForm] = useState(fromDetails)
  const [fieldErrors, setFieldErrors] = useState<BankDetailsFieldErrors>({})
  const s = (k: string) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setFieldErrors((p) => ({ ...p, [k]: undefined }))
  }

  const startEdit = () => { setForm(fromDetails()); setFieldErrors({}); setSaveError(null); setEditing(true) }

  const handleSave = async () => {
    const result = bankDetailsSchema.safeParse(form)
    if (!result.success) {
      const errs: BankDetailsFieldErrors = {}
      for (const issue of result.error.issues) {
        const f = issue.path[0] as keyof BankDetailsFieldErrors
        if (!errs[f]) errs[f] = issue.message
      }
      setFieldErrors(errs); return
    }
    setSaving(true); setSaveError(null)
    const r = await updateEmployeeCard(employeeId, 'bank_details_card', result.data)
    if (r.success) { setEditing(false); toast.success('Bank details updated'); await onSaveSuccess() }
    else setSaveError(r.error)
    setSaving(false)
  }

  const fe = fieldErrors
  return (
    <CardShell title="Bank & Finance" editing={editing} saving={saving} saveError={saveError} onEdit={startEdit} onCancel={() => setEditing(false)} onSave={handleSave}>
      {editing ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <FL>Bank name </FL>
            <Input value={form.bank_name} onChange={(e) => s('bank_name')(e.target.value)} className={cn(INPUT, fe.bank_name && 'border-destructive')} />
            {fe.bank_name && <p className="ml-1 text-xs text-destructive">{fe.bank_name}</p>}
          </div>
          <div className="space-y-1">
            <FL>Account name </FL>
            <Input value={form.account_name} onChange={(e) => s('account_name')(e.target.value)} className={cn(INPUT, fe.account_name && 'border-destructive')} />
            {fe.account_name && <p className="ml-1 text-xs text-destructive">{fe.account_name}</p>}
          </div>
          <div className="space-y-1">
            <FL>Account number </FL>
            <Input value={form.account_number} onChange={(e) => s('account_number')(e.target.value)} placeholder="10-digit number" inputMode="numeric" maxLength={10} className={cn(INPUT, fe.account_number && 'border-destructive')} />
            {fe.account_number && <p className="ml-1 text-xs text-destructive">{fe.account_number}</p>}
          </div>
          <div className="space-y-1">
            <FL>Account type </FL>
            <select value={form.account_type} onChange={(e) => s('account_type')(e.target.value)} className={cn(SELECT, fe.account_type && 'border-destructive')}>
              <option value="">Select…</option>
              {ACCOUNT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {fe.account_type && <p className="ml-1 text-xs text-destructive">{fe.account_type}</p>}
          </div>
          <div className="space-y-1">
            <FL>BVN</FL>
            <Input value={form.bvn} onChange={(e) => s('bvn')(e.target.value)} placeholder="11-digit BVN" inputMode="numeric" maxLength={11} className={cn(INPUT, fe.bvn && 'border-destructive')} />
            {fe.bvn && <p className="ml-1 text-xs text-destructive">{fe.bvn}</p>}
          </div>
          <div className="space-y-1">
            <FL>NIN</FL>
            <Input value={form.nin} onChange={(e) => s('nin')(e.target.value)} placeholder="11-digit NIN" inputMode="numeric" maxLength={11} className={cn(INPUT, fe.nin && 'border-destructive')} />
            {fe.nin && <p className="ml-1 text-xs text-destructive">{fe.nin}</p>}
          </div>
          <div className="space-y-1">
            <FL>Pension Fund Administrator</FL>
            <Input value={form.pfa} onChange={(e) => s('pfa')(e.target.value)} className={cn(INPUT, fe.pfa && 'border-destructive')} placeholder='e.g. NIPOST' />
            {fe.pfa && <p className="ml-1 text-xs text-destructive">{fe.pfa}</p>}
          </div>
          <div className="space-y-1">
            <FL>RSA PIN</FL>
            <Input value={form.rsa_pin} onChange={(e) => s('rsa_pin')(e.target.value)} className={cn(INPUT, fe.rsa_pin && 'border-destructive')} placeholder='e.g. 123456' />
            {fe.rsa_pin && <p className="ml-1 text-xs text-destructive">{fe.rsa_pin}</p>}
          </div>
          <div className="space-y-1">
            <FL>Tax ID (TIN)</FL>
            <Input value={form.tax_id} onChange={(e) => s('tax_id')(e.target.value)} className={cn(INPUT, fe.tax_id && 'border-destructive')} placeholder='e.g. 1234567890' />
            {fe.tax_id && <p className="ml-1 text-xs text-destructive">{fe.tax_id}</p>}
          </div>
          <div className="space-y-1">
            <FL>NHF ID</FL>
            <Input value={form.nhf_id} onChange={(e) => s('nhf_id')(e.target.value)} className={cn(INPUT, fe.nhf_id && 'border-destructive')} placeholder='e.g. 1234567890' />
            {fe.nhf_id && <p className="ml-1 text-xs text-destructive">{fe.nhf_id}</p>}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldItem label="Bank name" value={bankDetails?.bank_name} />
          <FieldItem label="Account name" value={bankDetails?.account_name} />
          <FieldItem label="Account number" value={bankDetails?.account_number} />
          <FieldItem label="Account type" value={bankDetails?.account_type} />
          <FieldItem label="BVN" value={mask(bankDetails?.bvn)} />
          <FieldItem label="NIN" value={mask(bankDetails?.nin)} />
          <FieldItem label="PFA" value={bankDetails?.pfa} />
          <FieldItem label="RSA PIN" value={bankDetails?.rsa_pin} />
          <FieldItem label="Tax ID (TIN)" value={bankDetails?.tax_id} />
          <FieldItem label="NHF ID" value={bankDetails?.nhf_id} />
        </div>
      )}
    </CardShell>
  )
}

// ─── ActivityTab ──────────────────────────────────────────────────────────────

function ActivityTab({ changeHistory }: { changeHistory: ChangeEvent[] }) {
  if (changeHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
        <CheckCircle2Icon className="size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No change history yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {changeHistory.map((evt) => (
        <div key={evt.id} className="rounded-lg border bg-card p-3 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium capitalize">{evt.field.replace(/_/g, ' ')}</span>
            <span className="text-xs text-muted-foreground shrink-0">{fmtDate(evt.created_at)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span className="line-through">{String(evt.old_value ?? '—')}</span>
            <span>→</span>
            <span className="text-foreground font-medium">{String(evt.new_value ?? '—')}</span>
          </div>
          {evt.requester_name && <p className="text-xs text-muted-foreground">by {evt.requester_name}</p>}
        </div>
      ))}
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ModalSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {/* <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div> */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border p-4 space-y-3">
          <Skeleton className="h-4 w-28" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((j) => <Skeleton key={j} className="h-10 w-full" />)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { value: 'personal', label: 'Personal', Icon: UserIcon },
  { value: 'contact', label: 'Contact', Icon: PhoneIcon },
  { value: 'employment', label: 'Employment', Icon: BriefcaseIcon },
  { value: 'people', label: 'People', Icon: UsersIcon },
  { value: 'career', label: 'Career', Icon: GraduationCapIcon },
  { value: 'finance', label: 'Finance', Icon: CreditCardIcon },
  { value: 'activity', label: 'Activity', Icon: ClockIcon },
]

// ─── Main modal ───────────────────────────────────────────────────────────────

export function Employee360Modal({
  employeeId,
  open,
  onOpenChange,
  departments,
  jobRoles,
  lineManagerOptions,
  locations,
}: Employee360ModalProps) {
  const [data, setData] = useState<Employee360Response | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!employeeId) return
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/employees/${employeeId}/360`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as Employee360Response
      setData(json)
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to load employee data')
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  useEffect(() => {
    if (open && employeeId) {
      fetchData()
    } else if (!open) {
      setData(null)
      setFetchError(null)
    }
  }, [open, employeeId, fetchData])

  const onSaveSuccess = useCallback(async () => { await fetchData() }, [fetchData])

  const historyByField = useMemo(() => {
    const m = new Map<string, ChangeEvent>()
    if (!data) return m
    for (const e of data.changeHistory) {
      if (!m.has(e.field)) m.set(e.field, e)
    }
    return m
  }, [data])

  const employeeName = data
    ? [data.biodata.title, data.biodata.firstname, data.biodata.lastname].filter(Boolean).join(' ') || data.employee.email
    : ''

  const initials = data
    ? [data.biodata.firstname?.[0], data.biodata.lastname?.[0]].filter(Boolean).join('').toUpperCase().slice(0, 2) || '?'
    : '?'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <Tabs defaultValue="personal" className="flex flex-col h-full overflow-hidden">

          {/* ── Fixed header ─────────────────────────────────────────────── */}
          <div className="shrink-0 border-b px-5 pt-4 pb-0">
            <div className="flex items-center gap-3 pb-3">
              <Avatar className="size-11 shrink-0">
                <AvatarFallback className="text-sm font-semibold bg-muted">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold truncate">
                  {loading && !data ? 'Loading…' : employeeName || '—'}
                </DialogTitle>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {data
                    ? [data.employee.job_role_title, data.employee.department_name].filter(Boolean).join(' · ')
                    : ''}
                </p>
              </div>
            </div>

            {/* Scrollable tab bar */}
            <div className="overflow-x-auto">
              <TabsList className="h-auto bg-transparent p-0 gap-0 rounded-none flex w-max min-w-full">
                {TABS.map(({ value, label }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs font-medium shrink-0 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground"
                  >
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>

          {/* ── Scrollable body ───────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loading && !data ? (
              <ModalSkeleton />
            ) : fetchError ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
                <XCircleIcon className="size-8 text-destructive" />
                <p className="text-sm font-medium">Failed to load</p>
                <p className="text-xs text-muted-foreground">{fetchError}</p>
                <Button size="sm" variant="outline" onClick={fetchData} className="mt-1">Retry</Button>
              </div>
            ) : data ? (
              <>
                <TabsContent value="personal" className="mt-0 p-4 space-y-4">
                  <IdentityCard employeeId={employeeId!} biodata={data.biodata} historyByField={historyByField} onSaveSuccess={onSaveSuccess} />
                  <OriginCard employeeId={employeeId!} biodata={data.biodata} historyByField={historyByField} onSaveSuccess={onSaveSuccess} />
                  <FamilyCard employeeId={employeeId!} biodata={data.biodata} historyByField={historyByField} onSaveSuccess={onSaveSuccess} />
                  <HealthCard employeeId={employeeId!} biodata={data.biodata} historyByField={historyByField} onSaveSuccess={onSaveSuccess} />
                </TabsContent>

                <TabsContent value="contact" className="mt-0 p-4 space-y-4">
                  <ContactDetailsCard employeeId={employeeId!} employee={data.employee} biodata={data.biodata} historyByField={historyByField} onSaveSuccess={onSaveSuccess} />
                  <ResidentialAddressCard employeeId={employeeId!} address={data.address} onSaveSuccess={onSaveSuccess} />
                </TabsContent>

                <TabsContent value="employment" className="mt-0 p-4 space-y-4">
                  <RoleCard
                    employeeId={employeeId!}
                    employee={data.employee}
                    historyByField={historyByField}
                    onSaveSuccess={onSaveSuccess}
                    departments={departments}
                    jobRoles={jobRoles}
                    lineManagerOptions={lineManagerOptions}
                    locations={locations}
                  />
                  <ContractCard employeeId={employeeId!} employee={data.employee} historyByField={historyByField} onSaveSuccess={onSaveSuccess} />
                </TabsContent>

                <TabsContent value="people" className="mt-0 p-4 space-y-4">
                  <NextOfKinSection employeeId={employeeId!} records={data.nextOfKin} onSaveSuccess={onSaveSuccess} />
                  <PersonListSection employeeId={employeeId!} table="employee_family" title="Family Members" records={data.family} onSaveSuccess={onSaveSuccess} maxRecords={3} />
                  <PersonListSection employeeId={employeeId!} table="employee_dependants" title="Dependants" records={data.dependants} onSaveSuccess={onSaveSuccess} maxRecords={3} />
                </TabsContent>

                <TabsContent value="career" className="mt-0 p-4 space-y-4">
                  <ExperienceSection employeeId={employeeId!} records={data.experience} onSaveSuccess={onSaveSuccess} />
                  <EducationSection employeeId={employeeId!} records={data.education} onSaveSuccess={onSaveSuccess} />
                  <TrainingSection employeeId={employeeId!} records={data.training} onSaveSuccess={onSaveSuccess} />
                </TabsContent>

                <TabsContent value="finance" className="mt-0 p-4 space-y-4">
                  <BankDetailsCard employeeId={employeeId!} bankDetails={data.bankDetails} onSaveSuccess={onSaveSuccess} />
                </TabsContent>

                <TabsContent value="activity" className="mt-0 p-4">
                  <ActivityTab changeHistory={data.changeHistory} />
                </TabsContent>
              </>
            ) : null}
          </div>

        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
