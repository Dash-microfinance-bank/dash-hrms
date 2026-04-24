'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ChevronDown, ChevronUp } from 'lucide-react'

export type EmployeeNodeData = {
  name: string
  jobRole: string | null
  avatarUrl: string | null
  initials: string
  hasChildren: boolean
  collapsed: boolean
  onToggle: () => void
}

function EmployeeOrgNodeInner({ data }: NodeProps<EmployeeNodeData>) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm w-[240px] select-none overflow-hidden">
      <Handle
        type="target"
        position={Position.Top}
        className="bg-primary/40! border-primary/60! w-2! h-2!"
      />

      {/* Card header stripe */}
      {/* <div className="h-1.5 w-full bg-primary rounded-t-xl" /> */}

      <div className="fle items-center gap-3 px-3 pt-2.5 pb-2">
        <div className="flex items-center justify-center w-full mb-2">
        <Avatar className="size-10 shrink-0 ring-2 ring-primary/20">
          {data.avatarUrl && (
            <AvatarImage
              src={data.avatarUrl}
              alt={data.name}
              className="object-cover"
            />
          )}
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
            {data.initials}
          </AvatarFallback>
        </Avatar>
        </div>
        <div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-center text-slate-900 truncate leading-tight">
              {data.name}
            </p>
            <p className="text-xs text-muted-foreground truncate text-center mt-0.5">
              {data.jobRole ?? '—'}
            </p>
          </div>
        </div>
      </div>

      {/* {data.hasChildren && (
        <div className="flex justify-center pb-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              data.onToggle()
            }}
            className="flex items-center gap-1 text-xs text-primary font-medium hover:text-primary/80 transition-colors px-2.5 py-0.5 rounded-full hover:bg-primary/8 border border-primary/20"
          >
            {data.collapsed ? (
              <>
                <ChevronDown className="size-3" />
                <span>Expand</span>
              </>
            ) : (
              <>
                <ChevronUp className="size-3" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      )} */}

      <Handle
        type="source"
        position={Position.Bottom}
        className="bg-primary/40! border-primary/60! w-2! h-2!"
      />
    </div>
  )
}

export const EmployeeOrgNode = memo(EmployeeOrgNodeInner)
EmployeeOrgNodeInner.displayName = 'EmployeeOrgNode'
