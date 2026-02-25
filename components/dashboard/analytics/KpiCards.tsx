'use client'

import React from 'react'
import { Users, UserCheck, CalendarDays, Venus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { EmployeeKpiStats } from '@/types/analytics'

// ─── Individual KPI card ──────────────────────────────────────────────────────

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  loading?: boolean
}

function KpiCard({ title, value, subtitle, icon: Icon, loading }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="mt-2 h-7 w-20" />
            ) : (
              <p className="mt-1.5 text-2xl font-bold tracking-tight">{value}</p>
            )}
            {loading ? (
              <Skeleton className="mt-1.5 h-3.5 w-24" />
            ) : subtitle ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── KpiCards ─────────────────────────────────────────────────────────────────

interface KpiCardsProps {
  kpi: EmployeeKpiStats | null
  loading?: boolean
}

function genderRatioLabel(male: number, female: number): string {
  const total = male + female
  if (total === 0) return 'No data'
  const mPct = Math.round((male / total) * 100)
  const fPct = 100 - mPct
  return `${mPct}% M   ${fPct}% F`
}

export function KpiCards({ kpi, loading = false }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title="Total Employees"
        value={kpi?.totalEmployees.toLocaleString() ?? '—'}
        subtitle="All records"
        icon={Users}
        loading={loading}
      />
      <KpiCard
        title="Active Employees"
        value={kpi?.activeEmployees.toLocaleString() ?? '—'}
        subtitle="Currently active"
        icon={UserCheck}
        loading={loading}
      />
      <KpiCard
        title="Average Age"
        value={kpi?.avgAge != null ? `${kpi.avgAge} yrs` : '—'}
        subtitle="Active employees"
        icon={CalendarDays}
        loading={loading}
      />
      <KpiCard
        title="Gender Ratio"
        value={
          kpi
            ? genderRatioLabel(kpi.maleCount, kpi.femaleCount)
            : '—'
        }
        subtitle="Male / Female (active)"
        icon={Venus}
        loading={loading}
      />
    </div>
  )
}
