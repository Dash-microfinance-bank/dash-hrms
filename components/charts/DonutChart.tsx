'use client'

import React, { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Palette ──────────────────────────────────────────────────────────────────

const PALETTE = [
  'hsl(221, 83%, 53%)',
  'hsl(142, 71%, 45%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)',
  'hsl(280, 68%, 60%)',
  'hsl(199, 89%, 48%)',
  'hsl(24, 95%, 53%)',
  'hsl(160, 60%, 45%)',
  'hsl(330, 80%, 60%)',
  'hsl(48, 96%, 53%)',
]

function colorAt(index: number) {
  return PALETTE[index % PALETTE.length]
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DonutChartItem {
  label: string
  value: number
}

export interface DonutChartProps {
  data: DonutChartItem[]
  /** Height in pixels. Defaults to 260. */
  height?: number
  loading?: boolean
  /** Error message to render instead of the chart. */
  error?: string | null
  /** Suppress the built-in empty state (useful if parent wants to handle it). */
  hideEmptyState?: boolean
}

// ─── Chart data shape (includes pre-computed pct so the tooltip is stable) ───

interface DonutEntry {
  name: string
  value: number
  /** Pre-computed percentage string, e.g. "34.5" */
  pct: string
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
// Defined at module level (stable reference). Reads `pct` from the data payload
// so it never needs to be created inside the render function.

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: DonutEntry }>
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium text-foreground">{item.name}</p>
      <p className="mt-0.5 text-muted-foreground">
        {item.value.toLocaleString()}
        <span> ({item.payload.pct}%)</span>
      </p>
    </div>
  )
}

// ─── Custom legend ────────────────────────────────────────────────────────────

function DonutLegend({
  payload,
}: {
  payload?: Array<{ value: string; color?: string }>
}) {
  if (!payload?.length) return null
  return (
    <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs">
      {payload.map((entry, i) => (
        <li key={i} className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.value}</span>
        </li>
      ))}
    </ul>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DonutChart = React.memo(function DonutChart({
  data,
  height = 260,
  loading = false,
  error = null,
  hideEmptyState = false,
}: DonutChartProps) {
  // Compute percent once alongside the data so DonutTooltip stays stable.
  const chartData = useMemo<DonutEntry[]>(() => {
    const total = data.reduce((sum, d) => sum + d.value, 0)
    return data.map((d) => ({
      name: d.label,
      value: d.value,
      pct: total > 0 ? ((d.value / total) * 100).toFixed(1) : '0.0',
    }))
  }, [data])

  if (loading) {
    return (
      <div style={{ height }} className="flex flex-col items-center justify-center gap-3">
        <Skeleton className="h-40 w-40 rounded-full" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-lg bg-destructive/5 text-center text-xs text-destructive"
      >
        <p>Failed to load data</p>
      </div>
    )
  }

  if (!hideEmptyState && chartData.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-xs text-muted-foreground"
      >
        No data available
      </div>
    )
  }

  return (
    <div
      style={{ height }}
      className="**:outline-none **:shadow-none **:focus:outline-none **:focus-visible:outline-none"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart style={{ outline: 'none' }} tabIndex={-1}>
          <Pie
            data={chartData}
            cx="50%"
            cy="45%"
            innerRadius="40%"
            outerRadius="65%"
            paddingAngle={2}
            dataKey="value"
            style={{ outline: 'none' }}
            activeShape={false}
          >
            {chartData.map((_, index) => (
              <Cell key={index} fill={colorAt(index)} stroke="none" />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
          <Legend
            content={<DonutLegend />}
            formatter={(value) => value}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
})
