import React, { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { PayrollRunPreviewSkeleton } from '@/components/dashboard/PayrollRunPreviewSkeleton'
import { PayrollRunPreviewWithData } from '@/components/dashboard/PayrollRunPreviewWithData'
import type { PayrollRunStatus } from '@/lib/data/payroll-runs'

type Props = {
  params: Promise<{ id: string }>
}

// ---------------------------------------------------------------------------
// Status utilities (for future CTA buttons)
// ---------------------------------------------------------------------------

type CtaConfig = {
  primary: PayrollRunStatus | null
  disabled: PayrollRunStatus[]
  disabledReasons: Partial<Record<PayrollRunStatus, string>>
}

function getCtaConfig(status: PayrollRunStatus): CtaConfig {
  switch (status) {
    case 'DRAFT':
      return {
        primary: 'APPROVED',
        disabled: ['LOCKED', 'PAID'],
        disabledReasons: {
          LOCKED: 'Approve first to unlock locking',
          PAID: 'Approve and lock before disbursing',
        },
      }
    case 'APPROVED':
      return {
        primary: 'LOCKED',
        disabled: ['PAID'],
        disabledReasons: {
          PAID: 'Lock before disbursing',
        },
      }
    case 'LOCKED':
      return {
        primary: 'PAID',
        disabled: [],
        disabledReasons: {},
      }
    case 'PAID':
      return {
        primary: null,
        disabled: ['DRAFT', 'APPROVED', 'LOCKED', 'PAID'],
        disabledReasons: {
          DRAFT: 'Already disbursed',
          APPROVED: 'Already disbursed',
          LOCKED: 'Already disbursed',
          PAID: 'Already disbursed',
        },
      }
  }
}

type CtaButtonConfig = {
  label: string
  targetStatus: PayrollRunStatus
  toastMessage: string
}

const CTA_BUTTONS: CtaButtonConfig[] = [
  { label: 'Save Draft', targetStatus: 'DRAFT', toastMessage: 'Save draft coming soon' },
  { label: 'Approve', targetStatus: 'APPROVED', toastMessage: 'Approve action coming soon' },
  { label: 'Lock', targetStatus: 'LOCKED', toastMessage: 'Lock action coming soon' },
  { label: 'Disburse', targetStatus: 'PAID', toastMessage: 'Disburse action coming soon' },
]

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- wired when header CTAs ship
function CtaButtons({ status }: { status: PayrollRunStatus }) {
  const config = getCtaConfig(status)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {CTA_BUTTONS.map(({ label, targetStatus }) => {
        const isPrimary = config.primary === targetStatus
        const isDisabled = config.disabled.includes(targetStatus)
        const reason = config.disabledReasons[targetStatus]

        const button = (
          <Button
            key={targetStatus}
            variant={isPrimary ? 'default' : 'outline'}
            size="sm"
            disabled={isDisabled}
            aria-disabled={isDisabled}
          >
            {label}
          </Button>
        )

        if (isDisabled && reason) {
          return (
            <Tooltip key={targetStatus}>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="inline-flex">
                  {button}
                </span>
              </TooltipTrigger>
              <TooltipContent>{reason}</TooltipContent>
            </Tooltip>
          )
        }

        return button
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PayrollRunPage({ params }: Props) {
  const { id } = await params

  return (
    <section className="p-4 sm:p-6 space-y-10">
      <Link
        href="/dashboard/admin/payroll"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeftIcon className="size-4" />
        Back to Payroll
      </Link>

      <Suspense fallback={<PayrollRunPreviewSkeleton />}>
        <PayrollRunPreviewWithData id={id} />
      </Suspense>
    </section>
  )
}
