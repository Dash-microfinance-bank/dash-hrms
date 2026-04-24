'use client'

import { memo, useMemo } from 'react'
import { BaseEdge, type EdgeProps } from 'reactflow'

export type OrgChartBusData = {
  drawTrunk: boolean
  busY: number
  minCx: number
  maxCx: number
}

const STROKE = '#a78bfa'

function OrgChartBusEdgeInner({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  data,
}: EdgeProps) {
  const d = data as OrgChartBusData | undefined

  const path = useMemo(() => {
    if (!d) {
      return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`
    }

    // Keep the bus strictly below the source handle so the stem is never zero-length
    // (can happen for the top/root row if layout math is slightly ahead of measured handles).
    const busY = Math.max(d.busY, sourceY + 2)

    const parts: string[] = []

    // Parent stem: draw on every outgoing edge so it never depends on a single “carrier”
    // edge’s paint order / first-paint timing (fixes missing vertical from the root card).
    parts.push(`M ${sourceX} ${sourceY} L ${sourceX} ${busY}`)

    // Shared horizontal: one edge per manager only (classic T / bus between levels)
    if (d.drawTrunk) {
      parts.push(`M ${d.minCx} ${busY} L ${d.maxCx} ${busY}`)
    }

    // Per-child vertical drop from the bus down to the child’s top handle
    parts.push(`M ${targetX} ${busY} L ${targetX} ${targetY}`)

    return parts.join(' ')
  }, [d, sourceX, sourceY, targetX, targetY])

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      interactionWidth={18}
      style={{
        stroke: STROKE,
        strokeWidth: 1.5,
        strokeLinecap: 'square',
        strokeLinejoin: 'miter',
        fill: 'none',
        ...style,
      }}
    />
  )
}

export const OrgChartBusEdge = memo(OrgChartBusEdgeInner)
OrgChartBusEdgeInner.displayName = 'OrgChartBusEdge'
