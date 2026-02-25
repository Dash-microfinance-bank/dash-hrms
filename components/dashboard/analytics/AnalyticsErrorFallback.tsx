'use client'

import React from 'react'
import { AlertCircle } from 'lucide-react'

interface AnalyticsErrorFallbackProps {
  error: Error
  reset: () => void
}

export function AnalyticsErrorFallback({ error, reset }: AnalyticsErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-10 text-center">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <div>
        <p className="font-semibold text-destructive">Failed to load analytics</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {error.message || 'An unexpected error occurred.'}
        </p>
      </div>
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  )
}
