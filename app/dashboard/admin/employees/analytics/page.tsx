import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAllAnalyticsData } from '@/lib/api/analytics'
import { AnalyticsDashboard } from '@/components/dashboard/analytics/AnalyticsDashboard'
import { AnalyticsSkeleton } from '@/components/dashboard/analytics/AnalyticsSkeleton'

// ─── Inner server component (data fetching) ───────────────────────────────────
// Wrapped in Suspense so the skeleton renders immediately while this streams in.

async function AnalyticsContent() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Organization not found. Please contact your administrator.
      </div>
    )
  }

  const analyticsData = await getAllAnalyticsData(profile.organization_id)

  return <AnalyticsDashboard data={analyticsData} />
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmployeeAnalyticsPage() {
  return (
    <section className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Employee Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Workforce composition and distribution metrics for active employees.
        </p>
      </div>
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsContent />
      </Suspense>
    </section>
  )
}
