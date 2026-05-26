'use client'

import React, { useCallback, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  UsersIcon,
  CheckCircle2Icon,
  ShieldCheckIcon,
  SaveIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ApproverUserPicker } from '@/components/dashboard/ApproverUserPicker'
import {
  createWorkflowStep,
  updateWorkflowStep,
  saveWorkflowStepOrder,
} from '@/lib/actions/workflow-steps'
import {
  formatApproverRoleSlug,
  getApproverRoleOptions,
  type ApproverRoleSlug,
} from '@/lib/approval-workflow-roles'
import type { ApprovalWorkflowDetailMeta, OrgUserForApproverPicker } from '@/lib/data/approval-workflows'
import type { WorkflowStepRow } from '@/lib/data/workflow-steps'

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-primary transition-colors disabled:opacity-50 cursor-pointer'

type StepDialogState = { mode: 'add' } | { mode: 'edit'; stepId: string } | null

type StepFormState = {
  approverType: 'ROLE' | 'USER'
  approverRoleSlug: ApproverRoleSlug
  userId: string | null
}

function defaultRoleSlug(
  requestType: string,
  approverType: 'ROLE' | 'USER' = 'ROLE'
): ApproverRoleSlug {
  const options = getApproverRoleOptions(requestType, approverType)
  return (options[0]?.value ?? 'hr') as ApproverRoleSlug
}

function normalizeApproverRoleSlug(
  requestType: string,
  approverType: 'ROLE' | 'USER',
  slug: ApproverRoleSlug | null | undefined
): ApproverRoleSlug {
  const allowed = getApproverRoleOptions(requestType, approverType).map((o) => o.value)
  if (slug && allowed.includes(slug)) return slug
  return defaultRoleSlug(requestType, approverType)
}

function emptyForm(requestType: string): StepFormState {
  return {
    approverType: 'ROLE',
    approverRoleSlug: defaultRoleSlug(requestType, 'ROLE'),
    userId: null,
  }
}

function workflowStepToForm(step: WorkflowStepRow, requestType: string): StepFormState {
  return {
    approverType: step.approverType,
    approverRoleSlug: normalizeApproverRoleSlug(
      requestType,
      step.approverType,
      step.approverRoleSlug
    ),
    userId: step.userId,
  }
}

function isStepFormValid(form: StepFormState): boolean {
  if (!form.approverRoleSlug) return false
  if (form.approverType === 'USER' && !form.userId) return false
  return true
}

function AddStepDialog({
  open,
  onOpenChange,
  onSave,
  initial,
  nextOrder,
  requestType,
  users,
  saving,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSave: (form: StepFormState) => void
  initial?: StepFormState
  nextOrder: number
  requestType: string
  users: OrgUserForApproverPicker[]
  saving: boolean
}) {
  const [form, setForm] = useState<StepFormState>(() => initial ?? emptyForm(requestType))

  const roleOptions = useMemo(
    () => getApproverRoleOptions(requestType, form.approverType),
    [requestType, form.approverType]
  )

  const isEdit = !!initial

  const set = <K extends keyof StepFormState>(key: K, val: StepFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  const handleSave = () => {
    if (!isStepFormValid(form)) return
    onSave(form)
  }

  const canSave = isStepFormValid(form) && !saving

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit step' : `Add step ${nextOrder}`}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the step configuration below.'
              : 'Configure the new approval step.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Approver type</label>
            <select
              value={form.approverType}
              onChange={(e) => {
                const approverType = e.target.value as 'ROLE' | 'USER'
                setForm((prev) => {
                  const allowed = getApproverRoleOptions(requestType, approverType).map(
                    (o) => o.value
                  )
                  const approverRoleSlug = allowed.includes(prev.approverRoleSlug)
                    ? prev.approverRoleSlug
                    : defaultRoleSlug(requestType, approverType)
                  return {
                    ...prev,
                    approverType,
                    approverRoleSlug,
                    userId: approverType === 'USER' ? null : prev.userId,
                  }
                })
              }}
              className={SELECT_CLASS}
              disabled={saving}
            >
              <option value="ROLE">Role-based</option>
              <option value="USER">Specific user</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Approver role</label>
            <select
              value={form.approverRoleSlug}
              onChange={(e) => {
                const slug = e.target.value as ApproverRoleSlug
                setForm((prev) => ({
                  ...prev,
                  approverRoleSlug: slug,
                  userId: null,
                }))
              }}
              className={SELECT_CLASS}
              disabled={saving}
            >
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {form.approverType === 'USER' && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Approver</label>
              <ApproverUserPicker
                users={users}
                selectedUserId={form.userId}
                roleSlug={form.approverRoleSlug}
                onSelect={(userId) => set('userId', userId)}
                disabled={saving}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add step'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StepCard({
  step,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}: {
  step: WorkflowStepRow
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const roleLabel = formatApproverRoleSlug(step.approverRoleSlug)

  return (
    <div className="relative flex items-stretch gap-0">
      <div className="flex flex-col items-center w-10 shrink-0">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background z-10 shadow-sm">
          <span className="text-xs font-bold text-primary tabular-nums">{step.stepOrder}</span>
        </div>
        {!isLast && <div className="w-px flex-1 min-h-8 bg-border mt-1" />}
      </div>

      <div className="flex-1 mb-10 ml-3">
        <Card className="overflow-hidden rounded-sm shadow">
          <div className="h-1 w-full" />
          <CardContent className="py-3 px-3 space-y-4">
            <div className="flex items-center justify-between gap-">
              <div className="flex items-center justify-start gap-x-3 px-3 py-1.5 w-full h-full">
                {step.approverType === 'USER' ? (
                  <Avatar className="size-9 shrink-0">
                    {step.avatarUrl && (
                      <AvatarImage src={step.avatarUrl} alt={step.displayName} />
                    )}
                    <AvatarFallback>
                      {step.displayName
                        .split(/\s+/)
                        .map((s) => s[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2) || '?'}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="flex items-center justify-center gap-1 bg-primary text-primary-foreground rounded-full px-2 py-1 size-9">
                    <UsersIcon className="size-4 shrink-0" />
                  </div>
                )}
                {step.approverType === 'USER' ? (
                  <div className="gap-1">
                    <span className="text-sm font-medium shrink-0 block">{step.displayName}</span>
                    <span className="text-xs text-muted-foreground shrink-0 block">{roleLabel}</span>
                  </div>
                ) : (
                  <span className="text-sm font-medium shrink-0 block">{roleLabel}</span>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7 shrink-0">
                    <span className="sr-only">Step actions</span>
                    <svg viewBox="0 0 16 16" fill="currentColor" className="size-4" aria-hidden>
                      <circle cx="8" cy="3" r="1.5" />
                      <circle cx="8" cy="8" r="1.5" />
                      <circle cx="8" cy="13" r="1.5" />
                    </svg>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px]">
                  <DropdownMenuItem disabled={isFirst} onSelect={onMoveUp} className="gap-2">
                    <ChevronUpIcon className="size-4" />
                    Move up
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={isLast} onSelect={onMoveDown} className="gap-2">
                    <ChevronDownIcon className="size-4" />
                    Move down
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onEdit} className="gap-2">
                    <PencilIcon className="size-4" />
                    Edit step
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={onDelete}
                    className="gap-2 text-destructive focus:text-destructive"
                  >
                    <Trash2Icon className="size-4" />
                    Delete step
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export type ApprovalWorkflowDetailClientProps = {
  workflow: ApprovalWorkflowDetailMeta
  initialSteps: WorkflowStepRow[]
  users: OrgUserForApproverPicker[]
}

function buildStepsById(steps: WorkflowStepRow[]): Record<string, WorkflowStepRow> {
  const byId: Record<string, WorkflowStepRow> = {}
  for (const s of steps) byId[s.id] = s
  return byId
}

function buildStepsSyncKey(steps: WorkflowStepRow[]): string {
  return steps
    .map(
      (s) =>
        `${s.id}:${s.stepOrder}:${s.approverType}:${s.approverRoleSlug ?? ''}:${s.userId ?? ''}`
    )
    .join('|')
}

function ApprovalWorkflowDetailBody({
  workflow,
  initialSteps,
  users,
}: ApprovalWorkflowDetailClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const stepsById = useMemo(() => buildStepsById(initialSteps), [initialSteps])
  const persistedOrder = useMemo(() => initialSteps.map((s) => s.id), [initialSteps])

  const [draftOrder, setDraftOrder] = useState<string[]>(() => initialSteps.map((s) => s.id))
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(() => new Set())

  const [stepDialog, setStepDialog] = useState<StepDialogState>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [stepSaving, setStepSaving] = useState(false)
  const [orderSaving, setOrderSaving] = useState(false)

  const displaySteps = useMemo(() => {
    return draftOrder
      .filter((id) => !pendingDeleteIds.has(id))
      .map((id, idx) => {
        const step = stepsById[id]
        if (!step) return null
        return { ...step, stepOrder: idx + 1 }
      })
      .filter((s): s is WorkflowStepRow => s !== null)
  }, [draftOrder, pendingDeleteIds, stepsById])

  const survivingDraftOrder = useMemo(
    () => draftOrder.filter((id) => !pendingDeleteIds.has(id)),
    [draftOrder, pendingDeleteIds]
  )

  const showSaveChanges = useMemo(() => {
    return (
      pendingDeleteIds.size > 0 ||
      JSON.stringify(persistedOrder) !== JSON.stringify(survivingDraftOrder)
    )
  }, [persistedOrder, survivingDraftOrder, pendingDeleteIds])

  const moveUp = useCallback((id: string) => {
    setDraftOrder((prev) => {
      const idx = prev.indexOf(id)
      if (idx <= 0) return prev
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }, [])

  const moveDown = useCallback((id: string) => {
    setDraftOrder((prev) => {
      const idx = prev.indexOf(id)
      if (idx < 0 || idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }, [])

  const queueDelete = useCallback((id: string) => {
    setPendingDeleteIds((prev) => new Set(prev).add(id))
    setDeletingId(null)
  }, [])

  const handleSaveOrder = useCallback(() => {
    setOrderSaving(true)
    startTransition(async () => {
      const result = await saveWorkflowStepOrder(
        workflow.id,
        survivingDraftOrder,
        [...pendingDeleteIds]
      )
      setOrderSaving(false)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Workflow steps saved')
      router.refresh()
    })
  }, [workflow.id, survivingDraftOrder, pendingDeleteIds, router])

  const persistStep = useCallback(
    async (form: StepFormState, stepId?: string) => {
      setStepSaving(true)
      const input = {
        approverType: form.approverType,
        approverRoleSlug: form.approverRoleSlug,
        userId: form.approverType === 'USER' ? form.userId : null,
      }

      const result = stepId
        ? await updateWorkflowStep(stepId, workflow.id, input)
        : await createWorkflowStep(workflow.id, input)

      setStepSaving(false)

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(stepId ? 'Step updated' : 'Step added')
      setStepDialog(null)
      router.refresh()
    },
    [workflow.id, router]
  )

  const editingStep = useMemo(() => {
    if (stepDialog?.mode !== 'edit') return null
    return stepsById[stepDialog.stepId] ?? null
  }, [stepDialog, stepsById])

  const stepDialogInitial = useMemo(() => {
    if (stepDialog?.mode === 'edit' && editingStep) {
      return workflowStepToForm(editingStep, workflow.requestType)
    }
    return undefined
  }, [stepDialog, editingStep, workflow.requestType])

  const handleStepDialogSave = useCallback(
    (form: StepFormState) => {
      if (stepDialog?.mode === 'edit') {
        void persistStep(form, stepDialog.stepId)
      } else {
        void persistStep(form)
      }
    },
    [stepDialog, persistStep]
  )

  const deletingStep = useMemo(
    () => (deletingId ? stepsById[deletingId] : null),
    [deletingId, stepsById]
  )

  return (
    <section className="p-4 sm:p-6 w-full space-y-8">
      <Link
        href="/dashboard/admin/approval-workflow"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeftIcon className="size-4" />
        Back to workflows
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-20">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold truncate">{workflow.name}</h1>
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              {workflow.workflowTypeLabel}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Design the sequence of approval steps below. Add and edit steps save immediately;
            reorder and delete use Save changes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setStepDialog({ mode: 'add' })}
            className="shrink-0 gap-1.5 cursor-pointer"
          >
            <PlusIcon className="size-4" />
            Add step
          </Button>
          {showSaveChanges && (
            <Button
              onClick={handleSaveOrder}
              disabled={orderSaving || isPending}
              className="shrink-0 gap-1.5 bg-green-700 text-white hover:bg-green-800 cursor-pointer"
            >
              <SaveIcon className="size-4" />
              {orderSaving || isPending ? 'Saving…' : 'Save changes'}
            </Button>
          )}
        </div>
      </div>

      {displaySteps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 gap-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <ShieldCheckIcon className="size-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">No steps yet</p>
            <p className="text-sm text-muted-foreground">
              Add the first step to define who approves this workflow.
            </p>
          </div>
          <Button variant="outline" onClick={() => setStepDialog({ mode: 'add' })} className="gap-1.5">
            <PlusIcon className="size-4" />
            Add first step
          </Button>
        </div>
      ) : (
        <div className="relative w-full sm:w-[30%] mx-auto">
          {displaySteps.map((step, idx) => (
            <StepCard
              key={step.id}
              step={step}
              isFirst={idx === 0}
              isLast={idx === displaySteps.length - 1}
              onMoveUp={() => moveUp(step.id)}
              onMoveDown={() => moveDown(step.id)}
              onEdit={() => setStepDialog({ mode: 'edit', stepId: step.id })}
              onDelete={() => setDeletingId(step.id)}
            />
          ))}

          <div className="flex items-center gap-3 ml-0 mt-1">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40 bg-muted/30">
              <CheckCircle2Icon className="size-4 text-muted-foreground" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Request approved</span>
          </div>
        </div>
      )}

      <AddStepDialog
        key={
          stepDialog === null
            ? 'closed'
            : stepDialog.mode === 'edit'
              ? `edit-${stepDialog.stepId}`
              : 'add'
        }
        open={stepDialog !== null}
        onOpenChange={(open) => {
          if (!open) setStepDialog(null)
        }}
        onSave={handleStepDialogSave}
        initial={stepDialogInitial}
        nextOrder={displaySteps.length + 1}
        requestType={workflow.requestType}
        users={users}
        saving={stepSaving}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(v) => !v && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete step?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingStep ? (
                <>
                  <strong>{formatApproverRoleSlug(deletingStep.approverRoleSlug)}</strong> (Step{' '}
                  {deletingStep.stepOrder}) will be removed when you save changes.
                </>
              ) : (
                'This step will be removed when you save changes.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deletingId && queueDelete(deletingId)}
            >
              Delete step
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

export function ApprovalWorkflowDetailClient(props: ApprovalWorkflowDetailClientProps) {
  const stepsKey = buildStepsSyncKey(props.initialSteps)
  return <ApprovalWorkflowDetailBody key={stepsKey} {...props} />
}
