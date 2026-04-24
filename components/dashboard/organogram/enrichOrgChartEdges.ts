import type { Edge, Node } from 'reactflow'
import type { EmployeeNodeData } from './EmployeeOrgNode'
import type { OrgChartBusData } from './OrgChartBusEdge'

type OrgNode = Node<EmployeeNodeData>

/**
 * After Dagre has positioned nodes, attach bus geometry so `OrgChartBusEdge` can draw:
 * - one vertical from the parent’s bottom handle
 * - one shared horizontal across all direct reports (drawn once per manager)
 * - a vertical drop into each child’s top handle
 */
export function enrichOrgChartEdges(
  nodes: OrgNode[],
  edges: Edge[],
  nodeWidth: number,
  nodeHeight: number
): Edge[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]))

  const bySource = new Map<string, Edge[]>()
  for (const e of edges) {
    const list = bySource.get(e.source) ?? []
    list.push(e)
    bySource.set(e.source, list)
  }

  const trunkCarrierId = new Map<string, string>()
  for (const [source, list] of bySource) {
    if (list.length === 0) continue
    const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id))
    trunkCarrierId.set(source, sorted[0]!.id)
  }

  return edges.map((e) => {
    const parent = nodeById.get(e.source)
    const child = nodeById.get(e.target)
    const siblings = bySource.get(e.source) ?? [e]

    if (!parent || !child) {
      return { ...e, type: 'orgChartBus', animated: false }
    }

    const pCx = parent.position.x + nodeWidth / 2
    const pBottom = parent.position.y + nodeHeight

    const metrics = siblings
      .map((s) => {
        const c = nodeById.get(s.target)
        if (!c) return null
        return { edgeId: s.id, cx: c.position.x + nodeWidth / 2, topY: c.position.y }
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)

    if (metrics.length === 0) {
      return { ...e, type: 'orgChartBus', animated: false }
    }

    const minCx = Math.min(pCx, ...metrics.map((m) => m.cx))
    const maxCx = Math.max(pCx, ...metrics.map((m) => m.cx))
    const minTopY = Math.min(...metrics.map((m) => m.topY))
    const busY = pBottom + Math.max(20, (minTopY - pBottom) * 0.5)

    const busData: OrgChartBusData = {
      drawTrunk: trunkCarrierId.get(e.source) === e.id,
      busY,
      minCx,
      maxCx,
    }

    return {
      ...e,
      type: 'orgChartBus',
      animated: false,
      data: busData,
    }
  })
}
