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

// ─── Palette ──────────────────────────────────────────────────────────────────

const PALETTE = [
  'hsl(221, 83%, 53%)',
  'hsl(142, 71%, 45%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)',
  'hsl(280, 68%, 60%)',
  'hsl(199, 89%, 48%)',
]

function colorAt(index: number) {
  return PALETTE[index % PALETTE.length]
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VerticalBarChartItem {
  label: string
  value: number
}

export interface VerticalBarChartProps {
  data: VerticalBarChartItem[]
  /** Whether each bar gets a distinct colour. Defaults to true. */
  multiColor?: boolean
  /** Single colour override when multiColor is false. */
  barColor?: string
  /** Height in pixels. Defaults to 260. */
  height?: number
  loading?: boolean
  error?: string | null
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function VBarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; fill: string }>
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

export const VerticalBarChart = React.memo(function VerticalBarChart({
  data,
  multiColor = true,
  barColor = 'hsl(221, 83%, 53%)',
  height = 260,
  loading = false,
  error = null,
}: VerticalBarChartProps) {
  const chartData = useMemo(
    () => data.map((d) => ({ name: d.label, value: d.value })),
    [data]
  )

  if (loading) {
    return (
      <div
        style={{ height }}
        className="flex items-end justify-center gap-3 px-4 pb-6"
      >
        {[40, 70, 55, 85, 60, 45].map((h, i) => (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <Skeleton className="w-full" style={{ height: `${h}%` }} />
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
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

  if (chartData.length === 0) {
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
      className="[&_*]:outline-none [&_*]:shadow-none [&_*:focus]:outline-none [&_*:focus-visible]:outline-none"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
          style={{ outline: 'none' }}
          tabIndex={-1}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            allowDecimals={false}
            width={32}
          />
          <Tooltip content={<VBarTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0)' }} />
          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            maxBarSize={60}
            style={{ outline: 'none' }}
            activeBar={false}
          >
            {chartData.map((_, index) => (
              <Cell
                key={index}
                fill={multiColor ? colorAt(index) : barColor}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
})
