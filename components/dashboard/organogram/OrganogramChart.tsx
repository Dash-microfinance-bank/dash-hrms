'use client'

import 'reactflow/dist/style.css'

import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
  type ReactFlowInstance,
} from 'reactflow'
import dagre from '@dagrejs/dagre'
import type { EmployeeRow } from '@/lib/data/employees'
import { EmployeeOrgNode, type EmployeeNodeData } from './EmployeeOrgNode'
import { OrgChartBusEdge } from './OrgChartBusEdge'
import { enrichOrgChartEdges } from './enrichOrgChartEdges'

// ─── Constants ──────────────────────────────────────────────────────────────

const NODE_WIDTH = 240
const NODE_HEIGHT = 96 // includes the collapse button row

// ─── Stable node types map (defined outside to avoid re-registration) ────────

const nodeTypes = { employeeNode: EmployeeOrgNode }

const edgeTypes = { orgChartBus: OrgChartBusEdge }

// ─── Dagre layout helper ────────────────────────────────────────────────────

function applyDagreLayout(
  nodes: Node<EmployeeNodeData>[],
  edges: Edge[]
): Node<EmployeeNodeData>[] {
  if (nodes.length === 0) return nodes

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 48, ranksep: 80, marginx: 32, marginy: 32 })

  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target)
  }

  dagre.layout(g)

  return nodes.map((n) => {
    const pos = g.node(n.id)
    return {
      ...n,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    }
  })
}

// ─── Main component ──────────────────────────────────────────────────────────

interface OrganogramChartProps {
  employees: EmployeeRow[]
}

export function OrganogramChart({ employees }: OrganogramChartProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null)

  const toggle = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // ── Build employee lookup + children map ──────────────────────────────────
  const { empById, childrenOf } = useMemo(() => {
    const empById = new Map(employees.map((e) => [e.id, e]))
    const childrenOf = new Map<string, string[]>()

    for (const emp of employees) {
      if (
        emp.manager_id &&
        empById.has(emp.manager_id) &&
        emp.manager_id !== emp.id
      ) {
        const list = childrenOf.get(emp.manager_id) ?? []
        list.push(emp.id)
        childrenOf.set(emp.manager_id, list)
      }
    }
    return { empById, childrenOf }
  }, [employees])

  // ── Compute visible nodes / edges (respects collapsed state) ─────────────
  const { layoutedNodes, layoutedEdges } = useMemo(() => {
    // Root = no manager, manager not in org, or self-referencing manager
    const roots = employees.filter(
      (e) => !e.manager_id || !empById.has(e.manager_id) || e.manager_id === e.id
    )

    // BFS to collect visible employee ids
    const visible = new Set<string>()
    const queue: string[] = roots.map((r) => r.id)

    while (queue.length > 0) {
      const id = queue.shift()!
      if (visible.has(id)) continue
      visible.add(id)
      if (!collapsedIds.has(id)) {
        for (const childId of childrenOf.get(id) ?? []) {
          queue.push(childId)
        }
      }
    }

    // Build React Flow nodes
    const rawNodes: Node<EmployeeNodeData>[] = []

    for (const id of visible) {
      const emp = empById.get(id)!
      const nameParts: string[] = []
      if (emp.biodata_firstname) nameParts.push(emp.biodata_firstname)
      if (emp.biodata_lastname) nameParts.push(emp.biodata_lastname)
      const name = nameParts.join(' ') || emp.email

      const initials =
        nameParts.length > 0
          ? nameParts.map((p) => p[0]?.toUpperCase() ?? '').join('')
          : (emp.email[0] ?? '?').toUpperCase()

      const hasChildren = (childrenOf.get(id)?.length ?? 0) > 0

      rawNodes.push({
        id,
        type: 'employeeNode',
        position: { x: 0, y: 0 },
        data: {
          name,
          jobRole: emp.job_role_title,
          avatarUrl: emp.avatar_url,
          initials,
          hasChildren,
          collapsed: collapsedIds.has(id),
          onToggle: () => toggle(id),
        },
      })
    }

    // Build React Flow edges (only between visible nodes)
    const rawEdges: Edge[] = []

    for (const id of visible) {
      const emp = empById.get(id)!
      if (emp.manager_id && visible.has(emp.manager_id) && emp.manager_id !== id) {
        rawEdges.push({
          id: `e-${emp.manager_id}-${id}`,
          source: emp.manager_id,
          target: id,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14,
            height: 14,
            color: '#a78bfa',
          },
          animated: false,
        })
      }
    }

    const layoutedNodes = applyDagreLayout(rawNodes, rawEdges)
    const layoutedEdges = enrichOrgChartEdges(
      layoutedNodes,
      rawEdges,
      NODE_WIDTH,
      NODE_HEIGHT
    )
    return { layoutedNodes, layoutedEdges }
  }, [employees, empById, childrenOf, collapsedIds, toggle])

  // ── Sync into React Flow state ────────────────────────────────────────────
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges)

  useEffect(() => {
    setNodes(layoutedNodes)
  }, [layoutedNodes, setNodes])

  useEffect(() => {
    setEdges(layoutedEdges)
  }, [layoutedEdges, setEdges])

  // Re-fit view whenever the visible set changes (e.g. collapse/expand)
  useEffect(() => {
    if (!rfInstanceRef.current) return
    // Small delay to let React Flow commit the new node positions first
    const timer = setTimeout(() => {
      rfInstanceRef.current?.fitView({ padding: 0.15, duration: 300 })
    }, 50)
    return () => clearTimeout(timer)
  }, [layoutedNodes])

  const handleInit = useCallback((instance: ReactFlowInstance) => {
    rfInstanceRef.current = instance
    instance.fitView({ padding: 0.15 })
  }, [])

  if (employees.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        No employees found for your organisation.
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={handleInit}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.05}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-slate-50"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#cbd5e1"
        />
        <Controls
          showInteractive={false}
          className="shadow-sm! border! border-slate-200! rounded-xl! overflow-hidden"
        />
      </ReactFlow>
    </div>
  )
}
