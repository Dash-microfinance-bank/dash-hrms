'use client'

import React, { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { CheckIcon, Loader2Icon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { getProfileUpdateRequestWithItems } from '@/lib/data/profile-update-requests'
import type {
  ProfileUpdateRequestWithItems,
  ProfileUpdateRequestItemRow,
} from '@/lib/data/profile-update-requests'
import {
  approveProfileUpdateItem,
  rejectProfileUpdateItem,
  approveAllProfileUpdateRequest,
  rejectAllProfileUpdateRequest,
} from '@/lib/actions/profile-update-requests'

const PROFILE_UPDATE_REQUEST_QUERY_KEY = 'profile-update-request'

const TAB_NAMES = ['Personal', 'Contact', 'Finance', 'Career', 'People'] as const

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
    id: 'residential_address',
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

const PERSONAL_FIELD_KEYS = new Set<string>(PERSONAL_SECTIONS.flatMap((s) => [...s.fieldKeys]))
const CONTACT_FIELD_KEYS = new Set<string>(CONTACT_SECTIONS.flatMap((s) => [...s.fieldKeys]))
const FINANCE_FIELD_KEYS = new Set<string>(FINANCE_SECTIONS.flatMap((s) => [...s.fieldKeys]))
const CAREER_TABLES = new Set<string>(['employee_experience', 'employee_education', 'employee_training'])
const PEOPLE_TABLES = new Set<string>(['employee_family', 'employee_next_of_kin', 'employee_dependants'])

function fieldLabel(fieldKey: string): string {
  const part = fieldKey.includes('.') ? fieldKey.split('.').pop()! : fieldKey
  return part
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return 'None'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object' && val !== null && 'value' in val)
    return formatValue((val as { value: unknown }).value)
  const s = String(val).trim()
  return s || '—'
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

function getOldNewFromItem(item: ProfileUpdateRequestItemRow): { old: string; new: string } {
  const oldRaw =
    item.old_value &&
    typeof item.old_value === 'object' &&
    'value' in item.old_value
      ? (item.old_value as { value: unknown }).value
      : item.old_value
  const newRaw =
    item.new_value &&
    typeof item.new_value === 'object' &&
    'value' in item.new_value
      ? (item.new_value as { value: unknown }).value
      : item.new_value
  return { old: formatValue(oldRaw), new: formatValue(newRaw) }
}

function getPayloadFromRecordItem(item: ProfileUpdateRequestItemRow): Record<string, unknown> {
  if (item.operation !== 'create_record' || item.new_value == null) return {}
  if (typeof item.new_value === 'object' && !Array.isArray(item.new_value))
    return item.new_value as Record<string, unknown>
  return {}
}

type RecordCardGridField = { label: string; key: string }

function renderExistingRecordCard(
  key: string,
  options: {
    primary: string
    secondary: string
    dates?: string
    gridFields: RecordCardGridField[]
    payload: Record<string, unknown>
  }
) {
  const { primary, secondary, dates, gridFields, payload } = options
  return (
    <div key={key} className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{primary || '—'}</p>
          <p className="truncate text-xs text-muted-foreground">{secondary || '—'}</p>
          {dates ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{dates}</p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Current
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 border-t pt-1 sm:grid-cols-2">
        {gridFields.map(({ label, key }) => (
          <FieldItem key={key} label={label} value={formatValue(payload[key])} />
        ))}
      </div>
    </div>
  )
}

function renderRecordCreateCard(
  item: ProfileUpdateRequestItemRow,
  options: {
    primary: string
    secondary: string
    dates?: string
    gridFields: RecordCardGridField[]
  },
  handlers: {
    onApprove: (id: string) => void
    onReject: (id: string) => void
    actingItemId: string | null
  }
) {
  const { primary, secondary, dates, gridFields } = options
  const payload = getPayloadFromRecordItem(item)
  const isPending = item.status === 'pending'
  const acting = handlers.actingItemId === item.id

  return (
    <div key={item.id} className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{primary || '—'}</p>
          <p className="truncate text-xs text-muted-foreground">{secondary || '—'}</p>
          {dates ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{dates}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {isPending ? (
            <>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="rounded-full size-6 shrink-0 cursor-pointer"
                disabled={!!acting}
                onClick={() => handlers.onReject(item.id)}
                title="Reject"
              >
                {acting ? <Loader2Icon className="size-3 animate-spin" /> : <XIcon className="size-3" />}
              </Button>
              <Button
                type="button"
                size="icon"
                className="rounded-full size-6 shrink-0 bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                disabled={!!acting}
                onClick={() => handlers.onApprove(item.id)}
                title="Approve"
              >
                {acting ? <Loader2Icon className="size-3 animate-spin" /> : <CheckIcon className="size-3" />}
              </Button>
            </>
          ) : (
            <span
              className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${
                item.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {item.status === 'approved' ? 'Approved' : 'Rejected'}
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 border-t pt-1 sm:grid-cols-2">
        {gridFields.map(({ label, key }) => (
          <FieldItem key={key} label={label} value={formatValue(payload[key])} />
        ))}
      </div>
    </div>
  )
}

type ProfileUpdateRequestModalProps = {
  requestId?: string | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSuccess?: () => void
}

export default function ProfileUpdateRequestModal({
  requestId = null,
  open = true,
  onOpenChange,
  onSuccess,
}: ProfileUpdateRequestModalProps) {
  const queryClient = useQueryClient()

  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: [PROFILE_UPDATE_REQUEST_QUERY_KEY, requestId],
    queryFn: () => getProfileUpdateRequestWithItems(requestId!),
    enabled: open && !!requestId,
  })
  const error = data === undefined && queryError ? (queryError as Error).message : (data === null ? 'Request not found' : null)

  type MutationContext = { previous: ProfileUpdateRequestWithItems | null | undefined } | undefined

  const approveMutation = useMutation<
    { success: true } | { success: false; error: string },
    Error,
    string,
    MutationContext
  >({
    mutationFn: approveProfileUpdateItem,
    onMutate: async (itemId) => {
      if (!requestId) return undefined
      await queryClient.cancelQueries({ queryKey: [PROFILE_UPDATE_REQUEST_QUERY_KEY, requestId] })
      const previous = queryClient.getQueryData<ProfileUpdateRequestWithItems | null>([
        PROFILE_UPDATE_REQUEST_QUERY_KEY,
        requestId,
      ])
      queryClient.setQueryData<ProfileUpdateRequestWithItems | null>(
        [PROFILE_UPDATE_REQUEST_QUERY_KEY, requestId],
        (old) => {
          if (!old) return old
          return {
            ...old,
            items: old.items.map((it) =>
              it.id === itemId ? { ...it, status: 'approved' as const } : it
            ),
          }
        }
      )
      return { previous }
    },
    onError: (_err, _itemId, context) => {
      if (context?.previous != null && requestId) {
        queryClient.setQueryData(
          [PROFILE_UPDATE_REQUEST_QUERY_KEY, requestId],
          context.previous
        )
      }
      toast.error('Failed to approve')
    },
    onSuccess: () => {
      toast.success('Item approved')
      // Do not call onSuccess here — modal stays open; no table refresh for single-field approve
    },
  })

  const rejectMutation = useMutation<
    { success: true } | { success: false; error: string },
    Error,
    string,
    MutationContext
  >({
    mutationFn: rejectProfileUpdateItem,
    onMutate: async (itemId) => {
      if (!requestId) return undefined
      await queryClient.cancelQueries({ queryKey: [PROFILE_UPDATE_REQUEST_QUERY_KEY, requestId] })
      const previous = queryClient.getQueryData<ProfileUpdateRequestWithItems | null>([
        PROFILE_UPDATE_REQUEST_QUERY_KEY,
        requestId,
      ])
      queryClient.setQueryData<ProfileUpdateRequestWithItems | null>(
        [PROFILE_UPDATE_REQUEST_QUERY_KEY, requestId],
        (old) => {
          if (!old) return old
          return {
            ...old,
            items: old.items.map((it) =>
              it.id === itemId ? { ...it, status: 'rejected' as const } : it
            ),
          }
        }
      )
      return { previous }
    },
    onError: (_err, _itemId, context) => {
      if (context?.previous != null && requestId) {
        queryClient.setQueryData(
          [PROFILE_UPDATE_REQUEST_QUERY_KEY, requestId],
          context.previous
        )
      }
      toast.error('Failed to reject')
    },
    onSuccess: () => {
      toast.success('Item rejected')
      // Do not call onSuccess here — modal stays open; no table refresh for single-field reject
    },
  })

  const approveAllMutation = useMutation({
    mutationFn: async () => {
      if (!requestId) throw new Error('No request selected')
      const result = await approveAllProfileUpdateRequest(requestId)
      if (!result.success) throw new Error(result.error)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROFILE_UPDATE_REQUEST_QUERY_KEY, requestId] })
      toast.success('Employee profile updated. All pending changes have been applied and the request is approved.')
      onOpenChange?.(false)
      onSuccess?.()
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const rejectAllMutation = useMutation({
    mutationFn: async () => {
      if (!requestId) throw new Error('No request selected')
      const result = await rejectAllProfileUpdateRequest(requestId)
      if (!result.success) throw new Error(result.error)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROFILE_UPDATE_REQUEST_QUERY_KEY, requestId] })
      toast.success('Request rejected')
      onOpenChange?.(false)
      onSuccess?.()
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const itemsByField = useMemo(() => {
    if (!data) return new Map<string, ProfileUpdateRequestItemRow>()
    const map = new Map<string, ProfileUpdateRequestItemRow>()
    for (const item of data.items) {
      if (item.operation === 'field_update') map.set(item.field_name, item)
    }
    return map
  }, [data])

  const recordCreateItemsByTable = useMemo(() => {
    if (!data) return new Map<string, ProfileUpdateRequestItemRow[]>()
    const map = new Map<string, ProfileUpdateRequestItemRow[]>()
    for (const item of data.items) {
      if (item.operation === 'create_record' && item.target_table) {
        const list = map.get(item.target_table) ?? []
        list.push(item)
        map.set(item.target_table, list)
      }
    }
    return map
  }, [data])

  const pendingCountByTab = useMemo((): Record<(typeof TAB_NAMES)[number], number> => {
    const out = { Personal: 0, Contact: 0, Finance: 0, Career: 0, People: 0 }
    if (!data) return out
    for (const item of data.items) {
      if (item.status !== 'pending') continue
      if (item.operation === 'field_update') {
        if (PERSONAL_FIELD_KEYS.has(item.field_name)) out.Personal += 1
        else if (CONTACT_FIELD_KEYS.has(item.field_name)) out.Contact += 1
        else if (FINANCE_FIELD_KEYS.has(item.field_name)) out.Finance += 1
      } else if (item.operation === 'create_record' && item.target_table) {
        if (CAREER_TABLES.has(item.target_table)) out.Career += 1
        else if (PEOPLE_TABLES.has(item.target_table)) out.People += 1
      }
    }
    return out
  }, [data])

  const pendingCount = useMemo(
    () => data?.items.filter((i) => i.status === 'pending').length ?? 0,
    [data]
  )
  const requestPending =
    data?.request.status === 'pending' ||
    data?.request.status === 'partially_approved'

  const actingItemId =
    approveMutation.isPending ? (approveMutation.variables as string) :
    rejectMutation.isPending ? (rejectMutation.variables as string) :
    null

  const handleApproveItem = (itemId: string) => {
    approveMutation.mutate(itemId)
  }

  const handleRejectItem = (itemId: string) => {
    rejectMutation.mutate(itemId)
  }

  const handleApproveAll = () => approveAllMutation.mutate()
  const handleRejectAll = () => rejectAllMutation.mutate()

  const renderSection = (
    sections: ReadonlyArray<{
      id: string
      title: string
      fieldKeys: readonly string[]
    }>
  ) => {
    if (!data) return null
    const { currentProfile } = data
    return (
      <div className="space-y-4">
        {sections.map((section) => (
          <div
            key={section.id}
            className="space-y-2 border px-4 py-6 rounded-lg"
          >
            <h4 className="text-lg font-bold mb-2">{section.title}</h4>
            <div className="grid lg:grid-cols-2 gap-x-6 gap-y-4 mt-6">
              {section.fieldKeys.map((fieldKey) => {
                const item = itemsByField.get(fieldKey)
                const isPending = item?.status === 'pending'
                const acting = actingItemId === item?.id
                const { old: oldStr, new: newStr } = item
                  ? getOldNewFromItem(item)
                  : { old: '—', new: '—' }

                if (item && isPending) {
                  return (
                    <div
                      key={fieldKey}
                      className="space-y-2 bg-muted-foreground/5 rounded-md p-2"
                    >
                      <p className="text-sm font-medium text-muted-foreground mb-2 px-1">
                        {fieldLabel(fieldKey)}
                      </p>
                      <div className="lg:flex items-center justify-between px-1">
                        <div className="space-x-4">
                          <span className="line-through text-destructive">
                            {oldStr}
                          </span>
                          <span className="text-green-600">{newStr}</span>
                        </div>
                        <div className="flex gap-2 mt-2 lg:mt-0">
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            className="rounded-full size-6 shrink-0 cursor-pointer"
                            disabled={!!acting}
                            onClick={() => handleRejectItem(item.id)}
                            title="Reject"
                          >
                            {acting ? (
                              <Loader2Icon className="size-3 animate-spin" />
                            ) : (
                              <XIcon className="size-3" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            className="rounded-full size-6 shrink-0 bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                            disabled={!!acting}
                            onClick={() => handleApproveItem(item.id)}
                            title="Approve"
                          >
                            {acting ? (
                              <Loader2Icon className="size-3 animate-spin" />
                            ) : (
                              <CheckIcon className="size-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                }

                if (item && !isPending) {
                  const resolvedVal = item.status === 'approved' ? newStr : oldStr
                  return (
                    <div
                      key={fieldKey}
                      className="space-y-2 bg-muted-foreground/5 rounded-md p-2"
                    >
                      <p className="text-sm font-medium text-muted-foreground mb-2 px-1">
                        {fieldLabel(fieldKey)}
                      </p>
                      <div className="flex items-center justify-between gap-2 px-1">
                        <span className="text-foreground">{resolvedVal}</span>
                        <span
                          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${
                            item.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.status === 'approved' ? 'Approved' : 'Rejected'}
                        </span>
                      </div>
                    </div>
                  )
                }

                const actualVal = formatValue(currentProfile[fieldKey])
                return (
                  <div
                    key={fieldKey}
                    className="space-y-2 bg-muted-foreground/5 rounded-md p-2"
                  >
                    <p className="text-sm font-medium text-muted-foreground mb-2 px-1">
                      {fieldLabel(fieldKey)}
                    </p>
                    <div className="px-1">
                      <span className="text-foreground">{actualVal}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => onOpenChange?.(o)}
    >
      <DialogContent className="sm:max-w-5xl px-0! pb-0!">
        <DialogHeader className="px-4">
          <DialogTitle>
            {/* {loading && !data
              ? 'Loading…'
              : data
                ? `${data.employee.firstname ?? ''} ${data.employee.lastname ?? ''}`.trim() || data.employee.email || 'Pending'
                : 'Profile update request'} */}
                Profile Updates Requests
          </DialogTitle>
        </DialogHeader>
        <section className="px-4">
          <Tabs defaultValue="Personal" className="w-full">
            <TabsList className="w-full grid grid-cols-5">
              {TAB_NAMES.map((name) => {
                const count = pendingCountByTab[name] ?? 0
                return (
                  <TabsTrigger key={name} value={name} className="relative">
                    <span className="flex items-center justify-center gap-1.5">
                      {name}
                      {count > 0 ? (
                        <span
                          className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0 text-xs font-semibold text-white"
                          aria-label={`${count} pending in ${name}`}
                        >
                          {count}
                        </span>
                      ) : null}
                    </span>
                  </TabsTrigger>
                )
              })}
            </TabsList>
            <div className="h-[500px] overflow-y-auto">
              <TabsContent value="Personal" className="mt-4 space-y-4">
                {loading && !data ? (
                  <p className="text-muted-foreground">Loading…</p>
                ) : error ? (
                  <p className="text-destructive">{error}</p>
                ) : !requestId ? (
                  <p className="text-muted-foreground">
                    Select a request to review.
                  </p>
                ) : (
                  renderSection(PERSONAL_SECTIONS)
                )}
              </TabsContent>
              <TabsContent value="Contact" className="mt-4 space-y-4">
                {!requestId ? (
                  <p className="text-muted-foreground">
                    Select a request to review.
                  </p>
                ) : (
                  renderSection(CONTACT_SECTIONS)
                )}
              </TabsContent>
              <TabsContent value="Finance" className="mt-4 space-y-4">
                {!requestId ? (
                  <p className="text-muted-foreground">
                    Select a request to review.
                  </p>
                ) : (
                  renderSection(FINANCE_SECTIONS)
                )}
              </TabsContent>
              <TabsContent value="Career" className="mt-4 space-y-4">
                {!requestId ? (
                  <p className="text-muted-foreground">Select a request to review.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-card p-4 space-y-3 experience-container">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Work Experience</h3>
                      </div>
                      <div className="space-y-3">
                        {data?.experience.map((rec) => {
                          const start = formatValue(rec.start_date)
                          const end = formatValue(rec.end_date)
                          const payload = rec as unknown as Record<string, unknown>
                          return renderExistingRecordCard(rec.id, {
                            primary: formatValue(rec.company),
                            secondary: formatValue(rec.position),
                            dates: [start, end].every((v) => v && v !== '—') ? `${start} - ${end}` : undefined,
                            gridFields: [
                              { label: 'Company phone', key: 'phone' },
                              { label: 'Company email', key: 'email' },
                              { label: 'Company address', key: 'address' },
                              { label: 'Reason for leaving', key: 'reason_for_leaving' },
                            ],
                            payload,
                          })
                        })}
                        {(recordCreateItemsByTable.get('employee_experience') ?? []).map((item) => {
                          const p = getPayloadFromRecordItem(item)
                          const start = formatValue(p.start_date)
                          const end = formatValue(p.end_date)
                          return renderRecordCreateCard(
                            item,
                            {
                              primary: formatValue(p.company),
                              secondary: formatValue(p.position),
                              dates: [start, end].every((v) => v && v !== '—') ? `${start} - ${end}` : undefined,
                              gridFields: [
                                { label: 'Company phone', key: 'phone' },
                                { label: 'Company email', key: 'email' },
                                { label: 'Company address', key: 'address' },
                                { label: 'Reason for leaving', key: 'reason_for_leaving' },
                              ],
                            },
                            { onApprove: handleApproveItem, onReject: handleRejectItem, actingItemId }
                          )
                        })}
                        {(recordCreateItemsByTable.get('employee_experience') ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">No work experience items in this request.</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-card p-4 space-y-3 education-container">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Education</h3>
                      </div>
                      <div className="space-y-3">
                        {data?.education.map((rec) => {
                          const start = formatValue(rec.start_date)
                          const end = formatValue(rec.end_date)
                          const degree = formatValue(rec.degree)
                          const course = formatValue(rec.course)
                          const payload = rec as unknown as Record<string, unknown>
                          return renderExistingRecordCard(rec.id, {
                            primary: formatValue(rec.school),
                            secondary: [degree, course].filter(Boolean).join(' · ') || '—',
                            dates: [start, end].every((v) => v && v !== '—') ? `${start} - ${end}` : undefined,
                            gridFields: [
                              { label: 'Course', key: 'course' },
                              { label: 'Grade / Class', key: 'grade' },
                              { label: 'Start date', key: 'start_date' },
                              { label: 'End date', key: 'end_date' },
                            ],
                            payload,
                          })
                        })}
                        {(recordCreateItemsByTable.get('employee_education') ?? []).map((item) => {
                          const p = getPayloadFromRecordItem(item)
                          const start = formatValue(p.start_date)
                          const end = formatValue(p.end_date)
                          const degree = formatValue(p.degree)
                          const course = formatValue(p.course)
                          return renderRecordCreateCard(
                            item,
                            {
                              primary: formatValue(p.school),
                              secondary: [degree, course].filter(Boolean).join(' · ') || '—',
                              dates: [start, end].every((v) => v && v !== '—') ? `${start} - ${end}` : undefined,
                              gridFields: [
                                { label: 'Course', key: 'course' },
                                { label: 'Grade / Class', key: 'grade' },
                                { label: 'Start date', key: 'start_date' },
                                { label: 'End date', key: 'end_date' },
                              ],
                            },
                            { onApprove: handleApproveItem, onReject: handleRejectItem, actingItemId }
                          )
                        })}
                        {(recordCreateItemsByTable.get('employee_education') ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">No education items in this request.</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-card p-4 space-y-3 trainings-container">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Trainings and Certificates</h3>
                      </div>
                      <div className="space-y-3">
                        {data?.training.map((rec) => {
                          const start = formatValue(rec.start_date)
                          const end = formatValue(rec.end_date)
                          const payload = rec as unknown as Record<string, unknown>
                          return renderExistingRecordCard(rec.id, {
                            primary: formatValue(rec.course),
                            secondary: formatValue(rec.institution),
                            dates: [start, end].every((v) => v && v !== '—') ? `${start} - ${end}` : undefined,
                            gridFields: [
                              { label: 'Licence / Certificate', key: 'license_name' },
                              { label: 'Issuing body', key: 'issuing_body' },
                            ],
                            payload,
                          })
                        })}
                        {(recordCreateItemsByTable.get('employee_training') ?? []).map((item) => {
                          const p = getPayloadFromRecordItem(item)
                          const start = formatValue(p.start_date)
                          const end = formatValue(p.end_date)
                          return renderRecordCreateCard(
                            item,
                            {
                              primary: formatValue(p.course),
                              secondary: formatValue(p.institution),
                              dates: [start, end].every((v) => v && v !== '—') ? `${start} - ${end}` : undefined,
                              gridFields: [
                                { label: 'Licence / Certificate', key: 'license_name' },
                                { label: 'Issuing body', key: 'issuing_body' },
                              ],
                            },
                            { onApprove: handleApproveItem, onReject: handleRejectItem, actingItemId }
                          )
                        })}
                        {(recordCreateItemsByTable.get('employee_training') ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">No training items in this request.</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="People" className="mt-4 space-y-4">
                {!requestId ? (
                  <p className="text-muted-foreground">Select a request to review.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-card p-4 space-y-3 family-members-container">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Family Members</h3>
                      </div>
                      <div className="space-y-3">
                        {data?.family.map((rec) => {
                          const payload = rec as unknown as Record<string, unknown>
                          const primary = [formatValue(rec.title), formatValue(rec.first_name), formatValue(rec.last_name)]
                            .filter((v) => v && v !== '—')
                            .join(' ') || '—'
                          return renderExistingRecordCard(rec.id, {
                            primary,
                            secondary: formatValue(rec.relationship),
                            gridFields: [
                              { label: 'Phone', key: 'phone' },
                              { label: 'Email', key: 'email' },
                              { label: 'Relationship', key: 'relationship' },
                              { label: 'Address', key: 'address' },
                            ],
                            payload,
                          })
                        })}
                        {(recordCreateItemsByTable.get('employee_family') ?? []).map((item) => {
                          const p = getPayloadFromRecordItem(item)
                          const primary = [formatValue(p.title), formatValue(p.first_name), formatValue(p.last_name)].filter((v) => v && v !== '—').join(' ') || '—'
                          return renderRecordCreateCard(
                            item,
                            {
                              primary,
                              secondary: formatValue(p.relationship),
                              gridFields: [
                                { label: 'Phone', key: 'phone' },
                                { label: 'Email', key: 'email' },
                                { label: 'Relationship', key: 'relationship' },
                                { label: 'Address', key: 'address' },
                              ],
                            },
                            { onApprove: handleApproveItem, onReject: handleRejectItem, actingItemId }
                          )
                        })}
                        {(recordCreateItemsByTable.get('employee_family') ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">No family member items in this request.</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-card p-4 space-y-3 next-of-kin-container">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Next of Kin</h3>
                      </div>
                      <div className="space-y-3">
                        {data?.nextOfKin.map((rec) => {
                          const payload = rec as unknown as Record<string, unknown>
                          const primary = [formatValue(rec.title), formatValue(rec.first_name), formatValue(rec.last_name)]
                            .filter((v) => v && v !== '—')
                            .join(' ') || '—'
                          return renderExistingRecordCard(rec.id, {
                            primary,
                            secondary: formatValue(rec.relationship),
                            gridFields: [
                              { label: 'Phone', key: 'phone' },
                              { label: 'Email', key: 'email' },
                              { label: 'Purpose', key: 'purpose' },
                              { label: 'Address', key: 'address' },
                            ],
                            payload,
                          })
                        })}
                        {(recordCreateItemsByTable.get('employee_next_of_kin') ?? []).map((item) => {
                          const p = getPayloadFromRecordItem(item)
                          const primary = [formatValue(p.title), formatValue(p.first_name), formatValue(p.last_name)].filter((v) => v && v !== '—').join(' ') || '—'
                          return renderRecordCreateCard(
                            item,
                            {
                              primary,
                              secondary: formatValue(p.relationship),
                              gridFields: [
                                { label: 'Phone', key: 'phone' },
                                { label: 'Email', key: 'email' },
                                { label: 'Purpose', key: 'purpose' },
                                { label: 'Address', key: 'address' },
                              ],
                            },
                            { onApprove: handleApproveItem, onReject: handleRejectItem, actingItemId }
                          )
                        })}
                        {(recordCreateItemsByTable.get('employee_next_of_kin') ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">No next of kin items in this request.</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-card p-4 space-y-3 dependency-container">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Dependants</h3>
                      </div>
                      <div className="space-y-3">
                        {data?.dependants.map((rec) => {
                          const payload = rec as unknown as Record<string, unknown>
                          const primary = [formatValue(rec.title), formatValue(rec.first_name), formatValue(rec.last_name)]
                            .filter((v) => v && v !== '—')
                            .join(' ') || '—'
                          return renderExistingRecordCard(rec.id, {
                            primary,
                            secondary: formatValue(rec.relationship),
                            gridFields: [
                              { label: 'Phone', key: 'phone' },
                              { label: 'Email', key: 'email' },
                              { label: 'Relationship', key: 'relationship' },
                              { label: 'Address', key: 'address' },
                            ],
                            payload,
                          })
                        })}
                        {(recordCreateItemsByTable.get('employee_dependants') ?? []).map((item) => {
                          const p = getPayloadFromRecordItem(item)
                          const primary = [formatValue(p.title), formatValue(p.first_name), formatValue(p.last_name)].filter((v) => v && v !== '—').join(' ') || '—'
                          return renderRecordCreateCard(
                            item,
                            {
                              primary,
                              secondary: formatValue(p.relationship),
                              gridFields: [
                                { label: 'Phone', key: 'phone' },
                                { label: 'Email', key: 'email' },
                                { label: 'Relationship', key: 'relationship' },
                                { label: 'Address', key: 'address' },
                              ],
                            },
                            { onApprove: handleApproveItem, onReject: handleRejectItem, actingItemId }
                          )
                        })}
                        {(recordCreateItemsByTable.get('employee_dependants') ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">No dependant items in this request.</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </section>
        <DialogFooter className="border-t pt-3 px-4 pb-2">
          <div className="flex gap-2 items-center justify-end h-full">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="rounded-full"
              disabled={!requestId || !requestPending || pendingCount === 0 || rejectAllMutation.isPending || !!actingItemId}
              onClick={handleRejectAll}
            >
              {rejectAllMutation.isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <XIcon className="size-4" />
              )}
              <span className="ml-1">Reject all</span>
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-full bg-green-600 hover:bg-green-700 text-white"
              disabled={!requestId || !requestPending || pendingCount === 0 || approveAllMutation.isPending || !!actingItemId}
              onClick={handleApproveAll}
            >
              {approveAllMutation.isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <CheckIcon className="size-4" />
              )}
              <span className="ml-1">Approve all</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
