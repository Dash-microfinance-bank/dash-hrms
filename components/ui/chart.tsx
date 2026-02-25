'use client'

import * as React from 'react'
import * as RechartsPrimitive from 'recharts'
import { cn } from '@/lib/utils'

// ─── Config types ─────────────────────────────────────────────────────────────

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode
    color?: string
    icon?: React.ComponentType
  }
}

type ChartContextValue = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextValue | null>(null)

function useChart() {
  const ctx = React.useContext(ChartContext)
  if (!ctx) throw new Error('useChart must be used inside <ChartContainer>')
  return ctx
}

// ─── ChartContainer ───────────────────────────────────────────────────────────

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    config: ChartConfig
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children']
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, '')}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        ref={ref}
        data-chart={chartId}
        className={cn('flex aspect-video justify-center text-xs', className)}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = 'ChartContainer'

// ─── ChartTooltip ─────────────────────────────────────────────────────────────

const ChartTooltip = RechartsPrimitive.Tooltip

type TooltipPayloadItem = {
  name?: string | number
  value?: string | number
  dataKey?: string | number
  color?: string
  payload?: Record<string, unknown>
}

interface ChartTooltipContentProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string | number
  className?: string
  hideLabel?: boolean
  indicator?: 'line' | 'dot' | 'dashed'
  nameKey?: string
}

const ChartTooltipContent = React.forwardRef<HTMLDivElement, ChartTooltipContentProps>(
  (
    {
      active,
      payload,
      className,
      indicator = 'dot',
      hideLabel = false,
      label,
      nameKey,
    },
    ref
  ) => {
    const { config } = useChart()

    if (!active || !payload?.length) return null

    const tooltipLabel = hideLabel ? null : (
      <p className="font-medium text-foreground">{String(label ?? '')}</p>
    )

    return (
      <div
        ref={ref}
        className={cn(
          'grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl',
          className
        )}
      >
        {tooltipLabel}
        <div className="grid gap-1.5">
          {payload.map((item, idx) => {
            const key = nameKey ?? item.name ?? item.dataKey ?? 'value'
            const cfgKey = String(key)
            const itemConfig = config[cfgKey] ?? config[String(item.dataKey)] ?? {}
            const color =
              (item.payload?.fill as string | undefined) ?? item.color ?? itemConfig.color

            return (
              <div key={idx} className="flex w-full flex-wrap items-stretch gap-2">
                {indicator !== 'line' && (
                  <div
                    className="shrink-0 rounded-[2px]"
                    style={
                      {
                        backgroundColor: color,
                        width: indicator === 'dot' ? 8 : 2,
                        height: indicator === 'dot' ? 8 : 'auto',
                        alignSelf: 'center',
                      } as React.CSSProperties
                    }
                  />
                )}
                <div className="flex flex-1 justify-between leading-none">
                  <span className="text-muted-foreground">
                    {itemConfig.label ?? String(item.name ?? '')}
                  </span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {typeof item.value === 'number'
                      ? item.value.toLocaleString()
                      : String(item.value ?? '')}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = 'ChartTooltipContent'

// ─── ChartLegend ──────────────────────────────────────────────────────────────

const ChartLegend = RechartsPrimitive.Legend

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    payload?: Array<{
      value: string
      color?: string
      dataKey?: string
      type?: string
    }>
    nameKey?: string
    hideIcon?: boolean
  }
>(({ className, payload, nameKey, hideIcon = false }, ref) => {
  const { config } = useChart()

  if (!payload?.length) return null

  return (
    <div
      ref={ref}
      className={cn('flex flex-wrap items-center justify-center gap-4', className)}
    >
      {payload.map((item, idx) => {
        const key = nameKey ?? item.value
        const itemConfig = config[String(key)] ?? {}
        const color = item.color ?? itemConfig.color

        return (
          <div key={idx} className="flex items-center gap-1.5">
            {!hideIcon && (
              <div
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: color }}
              />
            )}
            <span className="text-muted-foreground">{itemConfig.label ?? item.value}</span>
          </div>
        )
      })}
    </div>
  )
})
ChartLegendContent.displayName = 'ChartLegendContent'

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
}
