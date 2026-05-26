'use client'

import React, { useCallback, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PayrollRunPreviewTable } from '@/components/dashboard/PayrollRunPreviewTable'
import type { PayrollRunPreviewCompensationRow } from '@/lib/data/payroll-run-preview'
import type { PayrollRunStatus } from '@/lib/data/payroll-runs'
import type { PayrollApprovalState } from '@/lib/data/payroll-approvals'
import type { ConfiguredDeductionLine } from '@/lib/payroll/tax-calculator'
import {
  buildBreakdownMapFromRows,
  computePayrollPreviewTotals,
  type PayrollPreviewTotals,
} from '@/lib/payroll/preview-totals'

type Props = {
  payrollRunId: string
  rows: PayrollRunPreviewCompensationRow[]
  runHasPersistedEntries: boolean
  configuredDeductions: ConfiguredDeductionLine[]
  payrollRunStatus: PayrollRunStatus | null
  employeeCount: number
  approval: PayrollApprovalState
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(amount)
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className="text-xl sm:text-2xl font-bold break-all tabular-nums">{value}</p>
        {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  )
}

export function PayrollRunPreviewClient({
  payrollRunId,
  rows,
  runHasPersistedEntries,
  configuredDeductions,
  payrollRunStatus,
  employeeCount,
  approval,
}: Props) {
  const [totals, setTotals] = useState<PayrollPreviewTotals>(() =>
    computePayrollPreviewTotals(rows, buildBreakdownMapFromRows(rows), configuredDeductions)
  )

  const handleTotalsChange = useCallback((next: PayrollPreviewTotals) => {
    setTotals(next)
  }, [])

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Gross Pay"
          value={formatCurrency(totals.totalGross)}
          // sub={`${employeeCount} employees`}
        />
        <KpiCard label="Total Allowances" value={formatCurrency(totals.totalAllowances)} />
        <KpiCard label="Total Deductions" value={formatCurrency(totals.totalDeductions)} />
        <KpiCard label="Total Net Pay" value={formatCurrency(totals.totalNet)} />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-3">
          <h2 className="text-2xl font-semibold">Employee Preview</h2>
        </div>
        <PayrollRunPreviewTable
          payrollRunId={payrollRunId}
          rows={rows}
          runHasPersistedEntries={runHasPersistedEntries}
          configuredDeductions={configuredDeductions}
          payrollRunStatus={payrollRunStatus}
          approval={approval}
          onTotalsChange={handleTotalsChange}
        />
      </div>
    </div>
  )
}
