'use client'

import React from 'react'
import { cn } from '@/lib/utils'

const SIZE = 32
const STROKE_WIDTH = 3

type CircularProgressProps = {
  value: number
  size?: number
  strokeWidth?: number
  className?: string
  showLabel?: boolean
}

function getStrokeColor(value: number): string {
  if (value < 30) return 'stroke-destructive'
  if (value <= 70) return 'stroke-yellow-500'
  return 'stroke-green-500'
}

export function CircularProgress({
  value,
  size = SIZE,
  strokeWidth = STROKE_WIDTH,
  className,
  showLabel = true,
}: CircularProgressProps) {
  const clamped = Math.min(100, Math.max(0, value))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference
  const strokeColor = getStrokeColor(clamped)

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          className="stroke-muted"
          strokeWidth={strokeWidth}
          fill="none"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={cn('transition-all duration-300', strokeColor)}
          strokeWidth={strokeWidth}
          fill="none"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      {showLabel && (
        <span
          className="absolute inset-0 flex items-center justify-center text-[10px] font-medium tabular-nums"
          aria-label={`${Math.round(clamped)}% complete`}
        >
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  )
}
