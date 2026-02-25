'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KpiCards } from './KpiCards'
import { DonutChart } from '@/components/charts/DonutChart'
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart'
import { VerticalBarChart } from '@/components/charts/VerticalBarChart'
import type { EmployeeAnalyticsData } from '@/types/analytics'

// ─── Label formatters ─────────────────────────────────────────────────────────
// Converts snake_case / DB enum values to Title Case for the UI.

function titleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// ─── Chart card wrapper ───────────────────────────────────────────────────────

function ChartCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Card className="flex flex-col bg-gray-200">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-4">{children}</CardContent>
    </Card>
  )
}

// ─── AnalyticsDashboard ───────────────────────────────────────────────────────

interface AnalyticsDashboardProps {
  data: EmployeeAnalyticsData
}

export function AnalyticsDashboard({ data }: AnalyticsDashboardProps) {
  const {
    kpi,
    gender,
    religion,
    ageGroups,
    maritalStatus,
    departments,
    contractType,
    employmentStatus,
    stateOfOrigin,
    ethnicGroup,
    officeLocation,
  } = data

  // Pre-shape all chart data in one memo to avoid inline transform on each render.
  const charts = useMemo(
    () => ({
      gender: gender.map((r) => ({
        label: titleCase(r.gender),
        value: r.employeeCount,
      })),
      religion: religion.map((r) => ({
        label: titleCase(r.religion),
        value: r.employeeCount,
      })),
      ageGroups: ageGroups.map((r) => ({
        label: r.ageGroup,
        value: r.employeeCount,
      })),
      maritalStatus: maritalStatus.map((r) => ({
        label: titleCase(r.maritalStatus),
        value: r.employeeCount,
      })),
      departments: departments.map((r) => ({
        label: r.departmentName,
        value: r.employeeCount,
      })),
      contractType: contractType.map((r) => ({
        label: titleCase(r.contractType),
        value: r.employeeCount,
      })),
      employmentStatus: employmentStatus.map((r) => ({
        label: titleCase(r.employmentStatus),
        value: r.employeeCount,
      })),
      stateOfOrigin: stateOfOrigin.map((r) => ({
        label: titleCase(r.stateOfOrigin),
        value: r.employeeCount,
      })),
      ethnicGroup: ethnicGroup.map((r) => ({
        label: titleCase(r.ethnicGroup),
        value: r.employeeCount,
      })),
      officeLocation: officeLocation.map((r) => ({
        label: r.officeLocation,
        value: r.employeeCount,
      })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data]
  )

  return (
    <div className="space-y-6">
      {/* ── KPI row ──────────────────────────────────────────────────────── */}
      <KpiCards kpi={kpi} />

      {/* ── Composition donuts ───────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Workforce Composition
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ChartCard title="Gender">
            <DonutChart data={charts.gender} height={240} />
          </ChartCard>
          <ChartCard title="Contract Type">
            <DonutChart data={charts.contractType} height={240} />
          </ChartCard>
          <ChartCard title="Employment Status">
            <DonutChart data={charts.employmentStatus} height={240} />
          </ChartCard>
          <ChartCard title="Marital Status">
            <DonutChart data={charts.maritalStatus} height={240} />
          </ChartCard>
        </div>
      </section>

      {/* ── Distributions ────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Workforce Distribution
        </h2>

        {/* Row 1: Departments + Age Groups */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Headcount by Department">
            <HorizontalBarChart
              data={charts.departments}
              barColor="hsl(221, 83%, 53%)"
            />
          </ChartCard>
          <ChartCard title="Age Groups">
            <VerticalBarChart
              data={charts.ageGroups}
              height={Math.max(260, charts.ageGroups.length * 40 + 60)}
              multiColor
            />
          </ChartCard>
        </div>

        {/* Row 2: State of Origin + Religion */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="State of Origin">
            <HorizontalBarChart
              data={charts.stateOfOrigin}
              barColor="hsl(142, 71%, 45%)"
            />
          </ChartCard>
          <ChartCard title="Religion">
            <HorizontalBarChart
              data={charts.religion}
              barColor="hsl(38, 92%, 50%)"
            />
          </ChartCard>
        </div>

        {/* Row 3: Ethnic Group + Office Location */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Ethnic Group">
            <HorizontalBarChart
              data={charts.ethnicGroup}
              barColor="hsl(280, 68%, 60%)"
            />
          </ChartCard>
          <ChartCard title="Office Location">
            <HorizontalBarChart
              data={charts.officeLocation}
              barColor="hsl(199, 89%, 48%)"
            />
          </ChartCard>
        </div>
      </section>
    </div>
  )
}
