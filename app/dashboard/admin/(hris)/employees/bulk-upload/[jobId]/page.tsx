'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  ClockIcon,
  DownloadIcon,
  Loader2Icon,
  XCircleIcon,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'

interface BulkUploadJob {
  id: string
  status: JobStatus
  total_rows: number
  successful_rows: number
  failed_rows: number
  created_at: string
  updated_at: string
}

interface FailedRowLog {
  row_number: number
  raw_data: Record<string, string>
  error_message: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5_000
const TERMINAL_STATUSES: JobStatus[] = ['completed', 'failed']

function progressPercent(job: BulkUploadJob): number {
  if (job.total_rows === 0) return 0
  const processed = job.successful_rows + job.failed_rows
  return Math.min(100, Math.round((processed / job.total_rows) * 100))
}

function statusLabel(status: JobStatus): string {
  switch (status) {
    case 'pending':
      return 'Queued'
    case 'processing':
      return 'Processing…'
    case 'completed':
      return 'Completed'
    case 'failed':
      return 'Failed'
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** Build and trigger a CSV download entirely in-memory. */
function downloadCsv(filename: string, rows: string[][]): void {
  const escape = (v: string) =>
    v.includes(',') || v.includes('"') || v.includes('\n')
      ? `"${v.replace(/"/g, '""')}"`
      : v

  const csv = rows.map((row) => row.map(escape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, { icon: React.ReactNode; className: string }> = {
    pending: {
      icon: <ClockIcon className="size-3.5" />,
      className: 'bg-muted text-muted-foreground',
    },
    processing: {
      icon: <Loader2Icon className="size-3.5 animate-spin" />,
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    },
    completed: {
      icon: <CheckCircle2Icon className="size-3.5" />,
      className:
        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    },
    failed: {
      icon: <XCircleIcon className="size-3.5" />,
      className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    },
  }

  const { icon, className } = map[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        className
      )}
    >
      {icon}
      {statusLabel(status)}
    </span>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: number | string
  valueClassName?: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={cn('text-2xl font-bold tabular-nums', valueClassName)}>
        {value}
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BulkUploadJobPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const router = useRouter()

  const [job, setJob] = useState<BulkUploadJob | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [downloadingReport, setDownloadingReport] = useState(false)

  const supabase = useRef(createClient()).current

  // ── Fetch job ──────────────────────────────────────────────────────────────
  const fetchJob = useCallback(async () => {
    const { data, error } = await supabase
      .from('bulk_upload_jobs')
      .select(
        'id, status, total_rows, successful_rows, failed_rows, created_at, updated_at'
      )
      .eq('id', jobId)
      .single<BulkUploadJob>()

    if (error) {
      setLoadError(error.message)
      return
    }
    setJob(data)
  }, [supabase, jobId])

  // ── Initial load + polling ─────────────────────────────────────────────────
  useEffect(() => {
    fetchJob()
  }, [fetchJob])

  useEffect(() => {
    if (!job) return
    if (TERMINAL_STATUSES.includes(job.status)) return // stop polling

    const id = setInterval(fetchJob, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [job, fetchJob])

  // ── Error report download ──────────────────────────────────────────────────
  const handleDownloadReport = useCallback(async () => {
    setDownloadingReport(true)
    try {
      const { data: failedLogs, error } = await supabase
        .from('bulk_upload_row_logs')
        .select('row_number, raw_data, error_message')
        .eq('job_id', jobId)
        .eq('status', 'failed')
        .order('row_number', { ascending: true })
        .returns<FailedRowLog[]>()

      if (error) throw new Error(error.message)
      if (!failedLogs || failedLogs.length === 0) return

      // Header row uses the raw_data keys from the first failed row.
      const dataKeys = Object.keys(failedLogs[0].raw_data)
      const header = ['Row #', ...dataKeys, 'Error']
      const dataRows = failedLogs.map((log) => [
        String(log.row_number),
        ...dataKeys.map((k) => log.raw_data[k] ?? ''),
        log.error_message ?? '',
      ])

      downloadCsv(`bulk-upload-errors-${jobId.slice(0, 8)}.csv`, [
        header,
        ...dataRows,
      ])
    } catch (err) {
      console.error('[error-report]', err)
    } finally {
      setDownloadingReport(false)
    }
  }, [supabase, jobId])

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <XCircleIcon className="size-10 text-destructive" />
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Button variant="outline" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" />
        <span className="text-sm">Loading job…</span>
      </div>
    )
  }

  const pct = progressPercent(job)
  const isTerminal = TERMINAL_STATUSES.includes(job.status)
  const hasFailures = job.failed_rows > 0

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Back nav */}
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 gap-1.5 text-muted-foreground"
        onClick={() => router.push('/dashboard/admin/employees/bulk-upload')}
      >
        <ArrowLeftIcon className="size-4" />
        Back to Bulk Upload
      </Button>

      {/* Job card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-lg">Upload Job</CardTitle>
              <CardDescription className="font-mono text-xs">
                {job.id}
              </CardDescription>
            </div>
            <StatusBadge status={job.status} />
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Started {formatDate(job.created_at)}
            {isTerminal && ` · Finished ${formatDate(job.updated_at)}`}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {isTerminal ? 'Complete' : 'Progress'}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {pct}%
              </span>
            </div>
            <Progress
              value={pct}
              className={cn(
                'h-3',
                job.status === 'failed' && job.successful_rows === 0
                  ? '[&>div]:bg-destructive'
                  : hasFailures
                  ? '[&>div]:bg-amber-500'
                  : ''
              )}
            />
            {!isTerminal && (
              <p className="text-xs text-muted-foreground">
                Polling for updates every 5 seconds…
              </p>
            )}
          </div>

          <Separator />

          {/* Stat grid */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Total rows" value={job.total_rows} />
            <StatCard
              label="Successful"
              value={job.successful_rows}
              valueClassName="text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              label="Failed"
              value={job.failed_rows}
              valueClassName={hasFailures ? 'text-destructive' : undefined}
            />
          </div>

          {/* Terminal-state messages */}
          {isTerminal && (
            <div
              className={cn(
                'rounded-lg border p-4 text-sm',
                job.status === 'completed' && job.successful_rows > 0
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300'
              )}
            >
              {job.status === 'completed' && job.successful_rows > 0 ? (
                <span className="flex items-center gap-2 font-medium">
                  <CheckCircle2Icon className="size-4 shrink-0" />
                  {job.successful_rows} employee
                  {job.successful_rows !== 1 ? 's' : ''} imported successfully.
                  {hasFailures &&
                    ` ${job.failed_rows} row${job.failed_rows !== 1 ? 's' : ''} could not be imported.`}
                </span>
              ) : (
                <span className="flex items-center gap-2 font-medium">
                  <XCircleIcon className="size-4 shrink-0" />
                  The import failed. No employees were created.
                </span>
              )}
            </div>
          )}

          {/* Error report download */}
          {isTerminal && hasFailures && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleDownloadReport}
              disabled={downloadingReport}
            >
              {downloadingReport ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <DownloadIcon className="size-4" />
              )}
              Download error report (.csv)
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
