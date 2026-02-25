'use client'

import React, { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HorizontalBarChartItem {
  label: string
  value: number
}

export interface HorizontalBarChartProps {
  data: HorizontalBarChartItem[]
  /** Accent color for bars. Defaults to a blue. */
  barColor?: string
  /** Height in pixels (auto-expands for many bars). Min 160. */
  height?: number
  loading?: boolean
  error?: string | null
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function HBarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium text-foreground">{label}</p>
      <p className="mt-0.5 text-muted-foreground">
        {payload[0].value.toLocaleString()} employees
      </p>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export const HorizontalBarChart = React.memo(function HorizontalBarChart({
  data,
  barColor = 'hsl(221, 83%, 53%)',
  height,
  loading = false,
  error = null,
}: HorizontalBarChartProps) {
  // Each bar row needs ~36 px; enforce a reasonable minimum.
  const computedHeight = height ?? Math.max(160, data.length * 36 + 60)

  const chartData = useMemo(
    () => data.map((d) => ({ name: d.label, value: d.value })),
    [data]
  )

  // Must be declared before any early returns to satisfy the rules of hooks.
  // Allocates just enough pixels for the longest visible label so bars fill
  // the remaining container width. ~5.5 px/char at 11 px font, capped at 110 px.
  const yAxisWidth = useMemo(() => {
    if (!chartData.length) return 60
    const maxLen = Math.min(
      Math.max(...chartData.map((d) => d.name.length)),
      22 // matches the formatLabel truncation limit
    )
    return Math.min(Math.ceil(maxLen * 5.5) + 4, 110)
  }, [chartData])

  if (loading) {
    return (
      <div className="flex flex-col gap-2 py-2" style={{ height: computedHeight }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-4 w-20 shrink-0" />
            <Skeleton className="h-5 flex-1" style={{ maxWidth: `${30 + i * 12}%` }} />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{ height: computedHeight }}
        className="flex items-center justify-center rounded-lg bg-destructive/5 text-center text-xs text-destructive"
      >
        <p>Failed to load data</p>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div
        style={{ height: computedHeight }}
        className="flex items-center justify-center text-xs text-muted-foreground"
      >
        No data available
      </div>
    )
  }

  // Truncate labels that would overflow the axis column.
  const formatLabel = (value: string) =>
    value.length > 22 ? value.slice(0, 20) + '…' : value

  const maxValue = Math.max(...chartData.map((d) => d.value), 1)

  return (
    <div
      style={{ height: computedHeight }}
      className="**:outline-none **:shadow-none **:focus:outline-none **:focus-visible:outline-none"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
          style={{ outline: 'none' }}
          tabIndex={-1}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
          <XAxis
            type="number"
            domain={[0, maxValue]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={yAxisWidth}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={formatLabel}
          />
          <Tooltip content={<HBarTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0)' }} />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            maxBarSize={28}
            style={{ outline: 'none' }}
            activeBar={false}
          >
            {chartData.map((_, index) => (
              <Cell key={index} fill={barColor} fillOpacity={0.9} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
})
