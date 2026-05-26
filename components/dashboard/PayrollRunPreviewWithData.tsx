import { notFound } from 'next/navigation'
import { CalendarIcon, BuildingIcon } from 'lucide-react'
import { PayrollRunPreviewClient } from '@/components/dashboard/PayrollRunPreviewClient'
import { getPayrollRunPreviewData } from '@/lib/data/payroll-run-preview'
import type { PayrollRunStatus } from '@/lib/data/payroll-runs'

const STATUS_META: Record<PayrollRunStatus, { label: string; pillClass: string }> = {
  DRAFT: {
    label: 'Draft',
    pillClass: 'bg-muted text-muted-foreground',
  },
  APPROVED: {
    label: 'Approved',
    pillClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  },
  LOCKED: {
    label: 'Locked',
    pillClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  },
  PAID: {
    label: 'Paid',
    pillClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  },
}

type Props = {
  id: string
}

export async function PayrollRunPreviewWithData({ id }: Props) {
  const {
    run,
    rows: previewEmployees,
    runHasPersistedEntries,
    configuredDeductions,
    payrollRunStatus,
    approval,
  } = await getPayrollRunPreviewData(id)

  if (!run) notFound()

  const statusMeta = STATUS_META[run.status]
  const previewCount = previewEmployees.length

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-semibold">Payroll Run Preview</h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusMeta.pillClass}`}
            >
              {statusMeta.label}
            </span>
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {run.payroll_type}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <BuildingIcon className="size-3.5 shrink-0" />
              {run.pay_group_name}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="size-3.5 shrink-0" />
              {run.pay_period_label} &middot; {run.pay_date_label}
            </span>
          </div>
        </div>
      </div>

      <PayrollRunPreviewClient
        payrollRunId={id}
        rows={previewEmployees}
        runHasPersistedEntries={runHasPersistedEntries}
        configuredDeductions={configuredDeductions}
        payrollRunStatus={payrollRunStatus}
        employeeCount={previewCount}
        approval={approval}
      />
    </>
  )
}
