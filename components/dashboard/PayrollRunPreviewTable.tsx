'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MailIcon,
  MoreHorizontalIcon,
  SaveIcon,
  SearchIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { savePayrollEntryPreview, savePayrollRunDraft } from '@/lib/actions/payroll-entries'
import { lockPayrollRun } from '@/lib/actions/payroll-lock'
import {
  reviewPayrollApprovalStep,
  submitPayrollRunForApproval,
} from '@/lib/actions/payroll-approvals'
import type { PayrollApprovalState } from '@/lib/data/payroll-approvals'
import type {
  PayrollRunPreviewCompensationRow,
  PayrollRunEmployeePreviewRow,
} from '@/lib/data/payroll-run-preview'
import type { PayrollRunStatus } from '@/lib/data/payroll-runs'
import {
  BASIC_BREAKDOWN_TYPE,
  grossFromBreakdown,
  normalizeBreakdownWithBase,
  roundMoney,
  type AllowanceBreakdownItem,
} from '@/lib/payroll/gross-calculator'
import {
  computePayrollDeductions,
  type ConfiguredDeductionLine,
  type PayrollDeductionBreakdownItem,
} from '@/lib/payroll/tax-calculator'
import {
  buildBreakdownMapFromRows,
  computePayrollPreviewTotals,
  type PayrollPreviewTotals,
} from '@/lib/payroll/preview-totals'

export type { PayrollRunEmployeePreviewRow, PayrollRunPreviewCompensationRow }
export type { ConfiguredDeductionLine }

type LivePreviewRow = PayrollRunPreviewCompensationRow

type PreviewEditModal =
  | { employeeId: string; kind: 'allowances' }
  | { employeeId: string; kind: 'deductions' }

type Props = {
  payrollRunId: string
  rows: PayrollRunPreviewCompensationRow[]
  runHasPersistedEntries: boolean
  configuredDeductions?: ConfiguredDeductionLine[]
  payrollRunStatus: PayrollRunStatus | null
  approval: PayrollApprovalState
  onTotalsChange?: (totals: PayrollPreviewTotals) => void
}

const PAGE_SIZES = [10, 20, 50]
const SAVE_DEBOUNCE_MS = 500

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(amount)
}

function moneyCell(value: number | null, className?: string) {
  if (value == null) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <span className={className ?? 'font-mono text-sm tabular-nums'}>
      {formatCurrency(value)}
    </span>
  )
}

function SortHeader({
  label,
  column,
}: {
  label: string
  column: Column<LivePreviewRow>
}) {
  return (
    <Button
      variant="ghost"
      className="-ml-2 h-8 data-[state=open]:bg-accent"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {label}
      {column.getIsSorted() === 'asc' ? (
        <ArrowUpIcon className="ml-2 size-4" />
      ) : column.getIsSorted() === 'desc' ? (
        <ArrowDownIcon className="ml-2 size-4" />
      ) : (
        <ArrowUpDownIcon className="ml-2 size-4 opacity-50" />
      )}
    </Button>
  )
}

function DeductionLineRow({ item }: { item: PayrollDeductionBreakdownItem }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{item.name}</span>
      <span className="font-mono tabular-nums text-destructive">{formatCurrency(item.amount)}</span>
    </div>
  )
}

function DeductionsSectionHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2 pb-1">
      {label}
    </p>
  )
}

function DeductionsBreakdownView({ row }: { row: LivePreviewRow }) {
  const preTaxLines = row.deductions_breakdown.filter((d) => d.phase === 'PRE_TAX_DEDUCTION')
  const taxLines = row.deductions_breakdown.filter((d) => d.phase === 'TAX')
  const postTaxLines = row.deductions_breakdown.filter((d) => d.phase === 'POST_TAX_DEDUCTION')
  const noDeductions = row.deductions_breakdown.length === 0

  return (
    <div className="space-y-1 max-h-[60vh] overflow-y-auto py-1">
      {/* Gross */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Gross pay</span>
        <span className="font-mono tabular-nums font-semibold">{formatCurrency(row.gross)}</span>
      </div>

      {noDeductions ? (
        <p className="text-sm text-muted-foreground py-3">
          No deduction components are configured for this organisation.
        </p>
      ) : (
        <>
          {/* Pre-tax deductions */}
          {preTaxLines.length > 0 && (
            <>
              <DeductionsSectionHeader label="Pre-tax deductions" />
              {preTaxLines.map((item, i) => (
                <DeductionLineRow key={`pre-${i}`} item={item} />
              ))}
            </>
          )}

          {/* Taxable income */}
          <div className="flex items-center justify-between border-t pt-2 mt-2 text-sm">
            <span className="font-medium">Taxable income</span>
            <span className="font-mono tabular-nums">{formatCurrency(row.taxable_income)}</span>
          </div>

          {/* Tax */}
          {taxLines.length > 0 && (
            <>
              <DeductionsSectionHeader label="Tax" />
              {taxLines.map((item, i) => (
                <DeductionLineRow key={`tax-${i}`} item={item} />
              ))}
            </>
          )}

          {/* Post-tax deductions */}
          {postTaxLines.length > 0 && (
            <>
              <DeductionsSectionHeader label="Post-tax deductions" />
              {postTaxLines.map((item, i) => (
                <DeductionLineRow key={`post-${i}`} item={item} />
              ))}
            </>
          )}

          {/* Totals */}
          <div className="flex items-center justify-between border-t pt-2 mt-2 text-sm font-medium">
            <span>Total deductions</span>
            <span className="font-mono tabular-nums text-destructive">
              {formatCurrency(row.total_deductions)}
            </span>
          </div>
        </>
      )}

      {/* Net */}
      <div className="flex items-center justify-between border-t pt-2 mt-1 text-sm font-semibold">
        <span>Net pay</span>
        <span className="font-mono tabular-nums">{formatCurrency(row.net)}</span>
      </div>
    </div>
  )
}

export function PayrollRunPreviewTable({
  payrollRunId,
  rows,
  runHasPersistedEntries,
  configuredDeductions = [],
  payrollRunStatus,
  approval,
  onTotalsChange,
}: Props) {
  'use no memo'
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false)
  const [isReviewing, setIsReviewing] = useState(false)
  const [isLocking, setIsLocking] = useState(false)
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [breakdownByEmployeeId, setBreakdownByEmployeeId] = useState<Record<string, AllowanceBreakdownItem[]>>(
    () => buildBreakdownMapFromRows(rows)
  )
  const [editModal, setEditModal] = useState<PreviewEditModal | null>(null)

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const baseByEmployeeId = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.id, r.base_salary])),
    [rows]
  )

  const persistedEmployeeIds = useMemo(
    () => new Set(rows.filter((r) => r.has_payroll_entry).map((r) => r.id)),
    [rows]
  )

  useEffect(() => {
    setBreakdownByEmployeeId(buildBreakdownMapFromRows(rows))
  }, [payrollRunId, rows])

  // Notify parent after breakdown state commits (never during setState updaters).
  useEffect(() => {
    onTotalsChange?.(computePayrollPreviewTotals(rows, breakdownByEmployeeId, configuredDeductions))
  }, [breakdownByEmployeeId, rows, configuredDeductions, onTotalsChange])

  const showSaveDraft = !runHasPersistedEntries
  const showSubmitForApproval = approval.canSubmit
  const showApproveReject = approval.canReviewCurrentStep && approval.currentStepId
  const showLock = payrollRunStatus === 'APPROVED'

  const handleSubmitForApproval = async () => {
    setIsSubmittingApproval(true)
    try {
      const result = await submitPayrollRunForApproval(payrollRunId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Submitted for approval')
      router.refresh()
    } finally {
      setIsSubmittingApproval(false)
    }
  }

  const handleLock = async (): Promise<boolean> => {
    setIsLocking(true)
    try {
      const result = await lockPayrollRun(payrollRunId)
      if (!result.success) {
        toast.error(result.error)
        return false
      }
      const { generated, failed, total } = result
      if (failed > 0) {
        toast.warning(
          `Payroll locked. ${generated} of ${total} payslips generated; ${failed} failed.`
        )
      } else {
        toast.success(`Payroll locked. ${generated} payslip${generated === 1 ? '' : 's'} generated.`)
      }
      router.refresh()
      return true
    } finally {
      setIsLocking(false)
    }
  }

  const handleConfirmLock = async () => {
    const success = await handleLock()
    if (success) {
      setLockConfirmOpen(false)
    }
  }

  const handleReview = async (decision: 'approve' | 'reject') => {
    if (!approval.currentStepId) return
    setIsReviewing(true)
    try {
      const result = await reviewPayrollApprovalStep(
        payrollRunId,
        approval.currentStepId,
        decision
      )
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(decision === 'approve' ? 'Step approved' : 'Step rejected')
      router.refresh()
    } finally {
      setIsReviewing(false)
    }
  }

  const handleSaveDraft = async () => {
    setIsSaving(true)
    try {
      const entries = rows.map((r) => {
        const breakdown = breakdownByEmployeeId[r.id] ?? buildBreakdownMapFromRows(rows)[r.id]
        const gross = grossFromBreakdown(breakdown)
        return { employeeId: r.id, grossSalary: gross, allowanceBreakdown: breakdown }
      })

      const result = await savePayrollRunDraft({ payrollRunId, entries })
      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success('Draft saved')
      router.refresh()
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    const timers = saveTimers.current
    return () => {
      for (const t of Object.values(timers)) {
        clearTimeout(t)
      }
    }
  }, [])

  const scheduleSave = useCallback(
    (employeeId: string, breakdown: AllowanceBreakdownItem[]) => {
      // Only auto-save when the run already has entries AND this employee has one.
      if (!runHasPersistedEntries || !persistedEmployeeIds.has(employeeId)) return

      const prev = saveTimers.current[employeeId]
      if (prev) clearTimeout(prev)
      saveTimers.current[employeeId] = setTimeout(async () => {
        const base = baseByEmployeeId[employeeId] ?? 0
        const normalized = normalizeBreakdownWithBase(base, breakdown)
        const gross = grossFromBreakdown(normalized)
        const result = await savePayrollEntryPreview({
          payrollRunId,
          employeeId,
          grossSalary: gross,
          allowanceBreakdown: normalized,
        })
        if (!result.success) {
          toast.error(result.error)
        }
        delete saveTimers.current[employeeId]
      }, SAVE_DEBOUNCE_MS)
    },
    [payrollRunId, baseByEmployeeId, runHasPersistedEntries, persistedEmployeeIds]
  )

  const tableRows: LivePreviewRow[] = useMemo(
    () =>
      rows.map((r) => {
        const breakdown = breakdownByEmployeeId[r.id] ?? []
        const gross = grossFromBreakdown(breakdown)
        const deductions = computePayrollDeductions({ gross, baseSalary: r.base_salary, configuredDeductions })
        return {
          ...r,
          gross,
          deductions_breakdown: deductions.breakdown,
          taxable_income: deductions.taxableIncome,
          tax: deductions.tax,
          total_deductions: deductions.totalDeductions,
          net: deductions.net,
        }
      }),
    [rows, breakdownByEmployeeId, configuredDeductions]
  )

  const columns = useMemo<ColumnDef<LivePreviewRow>[]>(
    () => [
      {
        id: 'sn',
        header: () => <div className="text-center">S/N</div>,
        cell: ({ row, table }) => {
          const { pageIndex, pageSize } = table.getState().pagination
          const position = table.getRowModel().rows.findIndex((t) => t.id === row.id)
          return <div className="text-center">{pageIndex * pageSize + position + 1}</div>
        },
        size: 52,
        enableSorting: false,
        enableGlobalFilter: false,
      },
      {
        id: 'staff_id',
        header: ({ column }) => <SortHeader label="Staff ID" column={column} />,
        accessorKey: 'staff_id',
        enableGlobalFilter: true,
      },
      {
        id: 'name',
        header: ({ column }) => <SortHeader label="Name" column={column} />,
        accessorFn: (row) => `${row.first_name} ${row.last_name}`,
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.first_name} {row.original.last_name}
          </span>
        ),
        enableGlobalFilter: true,
      },
      {
        id: 'pay_grade',
        header: ({ column }) => <SortHeader label="Pay Grade" column={column} />,
        accessorKey: 'pay_grade',
        enableGlobalFilter: false,
      },
      {
        id: 'department',
        header: ({ column }) => <SortHeader label="Department" column={column} />,
        accessorKey: 'department',
        enableGlobalFilter: true,
      },
      {
        id: 'job_role',
        header: ({ column }) => <SortHeader label="Job Role" column={column} />,
        accessorKey: 'job_role',
        enableGlobalFilter: true,
      },
      {
        id: 'gross',
        header: ({ column }) => <SortHeader label="Gross" column={column} />,
        accessorFn: (row) => row.gross,
        cell: ({ row }) => moneyCell(row.original.gross),
        enableGlobalFilter: false,
      },
      {
        id: 'tax',
        header: ({ column }) => <SortHeader label="Tax" column={column} />,
        accessorKey: 'tax',
        cell: ({ row }) =>
          moneyCell(row.original.tax, 'font-mono text-sm tabular-nums text-destructive'),
        enableGlobalFilter: false,
      },
      {
        id: 'net',
        header: ({ column }) => <SortHeader label="Net" column={column} />,
        accessorKey: 'net',
        cell: ({ row }) =>
          moneyCell(row.original.net, 'font-mono text-sm tabular-nums font-semibold'),
        enableGlobalFilter: false,
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        enableGlobalFilter: false,
        size: 80,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontalIcon className="size-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  setEditModal({ employeeId: row.original.id, kind: 'allowances' })
                }
              >
                Edit allowances
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  setEditModal({ employeeId: row.original.id, kind: 'deductions' })
                }
              >
                Edit deductions
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: tableRows,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  const totalCount = tableRows.length
  const filteredCount = table.getFilteredRowModel().rows.length
  const tableBodyRows = table.getRowModel().rows
  const isEmpty = totalCount === 0
  const pageIndex = table.getState().pagination.pageIndex
  const pageSize = table.getState().pagination.pageSize
  const pageCount = table.getPageCount()

  const isAllowancesOpen = editModal?.kind === 'allowances'
  const isDeductionsOpen = editModal?.kind === 'deductions'
  const editEmployeeId = editModal?.employeeId ?? null

  // Use live tableRows for deductions modal so values stay current with allowance edits.
  const editingRow = editEmployeeId ? tableRows.find((r) => r.id === editEmployeeId) : null
  const editingBreakdown =
    isAllowancesOpen && editEmployeeId ? breakdownByEmployeeId[editEmployeeId] ?? [] : []
  const editingBasicLine =
    editingBreakdown.find((line) => line.type === BASIC_BREAKDOWN_TYPE) ?? editingBreakdown[0]
  const editingAllowanceLines = editingBreakdown.filter((line) => line.type !== BASIC_BREAKDOWN_TYPE)
  const editingGross = grossFromBreakdown(editingBreakdown)

  const updateAllowanceLineAmount = (allowanceIndex: number, raw: string) => {
    if (!isAllowancesOpen || !editEmployeeId) return
    const num = roundMoney(Number(raw))
    if (!Number.isFinite(num) || num < 0) return
    setBreakdownByEmployeeId((prev) => {
      const base = baseByEmployeeId[editEmployeeId] ?? 0
      const arr = normalizeBreakdownWithBase(base, [...(prev[editEmployeeId] ?? [])])
      const nonBasicIndices = arr
        .map((line, i) => (line.type === BASIC_BREAKDOWN_TYPE ? -1 : i))
        .filter((i): i is number => i >= 0)
      const realIndex = nonBasicIndices[allowanceIndex]
      if (realIndex == null || !arr[realIndex]) return prev
      arr[realIndex] = { ...arr[realIndex], amount: num }
      const next = { ...prev, [editEmployeeId]: arr }
      scheduleSave(editEmployeeId, arr)
      return next
    })
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 bg-card py-3 px-3 rounded-md">
      <Dialog open={isAllowancesOpen} onOpenChange={(open) => !open && setEditModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit allowances</DialogTitle>
            <DialogDescription>
              Gross is the sum of all lines below. Basic salary comes from the employee record;
              allowance amounts can be edited.
            </DialogDescription>
          </DialogHeader>
          {editingRow ? (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto py-2">
              {editingBasicLine ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="font-medium">{editingBasicLine.name}</span>
                    {/* <span className="text-muted-foreground text-xs">{editingBasicLine.type}</span> */}
                  </div>
                  <Input
                    type="text"
                    readOnly
                    disabled
                    className="bg-muted font-mono tabular-nums"
                    value={formatCurrency(editingBasicLine.amount)}
                  />
                </div>
              ) : null}
              {editingAllowanceLines.length === 0 ? (
                <p className="text-sm text-muted-foreground">No taxable allowance lines.</p>
              ) : (
                editingAllowanceLines.map((line, index) => (
                  <div key={`${line.salary_component_id ?? line.name}-${index}`} className="space-y-1.5">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="font-medium">{line.name}</span>
                      {/* <span className="text-muted-foreground text-xs">{line.type}</span> */}
                    </div>
                    <Label className="sr-only" htmlFor={`amt-${index}`}>
                      Amount for {line.name}
                    </Label>
                    <Input
                      id={`amt-${index}`}
                      type="number"
                      inputMode="decimal"
                      className="focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
                      step="0.01"
                      min={0}
                      value={line.amount}
                      onChange={(e) => updateAllowanceLineAmount(index, e.target.value)}
                    />
                  </div>
                ))
              )}
              <div className="flex justify-between border-t pt-3 text-sm">
                <span className="text-muted-foreground">Gross (sum of lines)</span>
                <span className="font-mono font-semibold tabular-nums">{formatCurrency(editingGross)}</span>
              </div>
            </div>
          ) : null}
          <DialogFooter className="flex-col items-start gap-2 sm:flex-row sm:items-center">
            {editEmployeeId && !persistedEmployeeIds.has(editEmployeeId) && (
              <p className="text-xs text-muted-foreground flex-1">
                Changes are preview only — save draft to persist.
              </p>
            )}
            <Button type="button" variant="outline" onClick={() => setEditModal(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeductionsOpen} onOpenChange={(open) => !open && setEditModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Deductions breakdown</DialogTitle>
            <DialogDescription>
              {editingRow
                ? `${editingRow.first_name} ${editingRow.last_name} · ${editingRow.staff_id}`
                : 'Employee deductions'}
            </DialogDescription>
          </DialogHeader>

          {editingRow ? (
            <DeductionsBreakdownView row={editingRow} />
          ) : (
            <p className="text-sm text-muted-foreground py-2">No data available.</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditModal(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={lockConfirmOpen}
        onOpenChange={(open) => {
          if (!isLocking) setLockConfirmOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lock payroll run?</AlertDialogTitle>
            <AlertDialogDescription>
              This will finalize the payroll run for {rows.length} employee
              {rows.length === 1 ? '' : 's'}, generate a payslip PDF for each, and upload them
              to storage. The run cannot be edited after locking.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLocking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isLocking}
              onClick={(e) => {
                e.preventDefault()
                void handleConfirmLock()
              }}
            >
              {isLocking ? 'Locking…' : 'Lock payroll'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search name, staff ID, department, role..."
            className="pl-8 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary!"
            value={globalFilter ?? ''}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showSaveDraft && (
            <Button
              variant="default"
              size="sm"
              className="cursor-pointer"
              disabled={isSaving}
              onClick={handleSaveDraft}
            >
              <SaveIcon className="size-4" />
              {isSaving ? 'Saving…' : 'Save Draft'}
            </Button>
          )}
          {showSubmitForApproval && (
            <Button
              variant="default"
              size="sm"
              className="cursor-pointer"
              disabled={isSubmittingApproval}
              onClick={handleSubmitForApproval}
            >
              {isSubmittingApproval ? 'Submitting…' : 'Submit for approval'}
            </Button>
          )}
          {showApproveReject && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                disabled={isReviewing}
                onClick={() => handleReview('reject')}
              >
                {isReviewing ? 'Working…' : 'Reject'}
              </Button>
              <Button
                variant="default"
                size="sm"
                className="cursor-pointer"
                disabled={isReviewing}
                onClick={() => handleReview('approve')}
              >
                {isReviewing ? 'Working…' : 'Approve'}
              </Button>
            </>
          )}
          {showLock && (
            <Button
              variant="default"
              size="sm"
              className="cursor-pointer"
              disabled={isLocking}
              onClick={() => setLockConfirmOpen(true)}
            >
              Lock Payroll
            </Button>
          )}
          {payrollRunStatus === 'LOCKED' && (
            <>
              <Button variant="default" size="sm" className="cursor-pointer">
                <MailIcon className="size-4 mr-0" />
                Send Payslips
              </Button>
              {/* <Button
                variant="ghost"
                size="sm"
                className="cursor-pointer bg-green-700 text-white hover:bg-green-800 hover:text-white"
              >
                <DownloadIcon className="size-4 mr-0" />
                Download Payslips
              </Button> */}
            </>
          )}
        </div>
      </div>

      <Table className="table-fixed">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="whitespace-normal align-middle"
                  style={{ width: header.getSize() }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {tableBodyRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                {isEmpty ? 'No employees in this payroll run.' : 'No employees match your search.'}
              </TableCell>
            </TableRow>
          ) : (
            tableBodyRows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className="whitespace-normal wrap-break-word align-top"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div>
          Showing {tableBodyRows.length} of {filteredCount}
          {filteredCount !== totalCount ? ` (${totalCount} total)` : ''}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2">
                Rows per page: {pageSize}
                <ChevronDownIcon className="size-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={String(pageSize)}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                {PAGE_SIZES.map((size) => (
                  <DropdownMenuRadioItem key={size} value={String(size)}>
                    {size}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <span>
            Page {pageCount === 0 ? 0 : pageIndex + 1} of {pageCount}
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeftIcon className="size-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
