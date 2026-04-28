'use client'

import { AnalyticsErrorFallback } from '@/components/dashboard/analytics/AnalyticsErrorFallback'

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <section className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Employee Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Workforce composition and distribution metrics for active employees.
        </p>
      </div>
      <AnalyticsErrorFallback error={error} reset={reset} />
    </section>
  )
}
