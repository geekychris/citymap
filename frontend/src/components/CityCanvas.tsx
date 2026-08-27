import { useCallback, useEffect, useMemo, useRef } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeChange,
  Connection as RFConnection,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
} from 'reactflow'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Component, Connection } from '../types'
import { api } from '../api/client'
import { ComponentNode } from './ComponentNode'
import { useUI } from '../store'

const nodeTypes = { component: ComponentNode }

export function CityCanvas({
  components,
  connections,
}: {
  components: Component[]
  connections: Connection[]
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner components={components} connections={connections} />
    </ReactFlowProvider>
  )
}

function CanvasInner({
  components,
  connections,
}: {
  components: Component[]
  connections: Connection[]
}) {
  const qc = useQueryClient()
  const rf = useReactFlow()
  const { selectedId, select, focusRootId, focusOn } = useUI()

  // Which subtree are we viewing? null = all roots.
  const visibleComponents = useMemo(() => {
    if (!focusRootId) return components
    const set = new Set<string>()
    const walk = (id: string) => {
      set.add(id)
      for (const c of components) if (c.parentId === id) walk(c.id)
    }
    walk(focusRootId)
    return components.filter((c) => set.has(c.id))
  }, [components, focusRootId])

  const { rfNodes, rfEdges } = useMemo(() => {
    const rootParent = focusRootId ? components.find((c) => c.id === focusRootId)?.parentId ?? null : null
    const hasChildren: Record<string, boolean> = {}
    for (const c of components) if (c.parentId) hasChildren[c.parentId] = true

    const rfNodes: Node[] = visibleComponents.map((c) => {
      const isFocusRoot = c.id === focusRootId
      const parentNode = isFocusRoot ? undefined : (c.parentId ?? undefined)
      // When a node is the focus root, drop it to origin so fitView bounds are
      // (0,0)–(w,h) regardless of where it lived inside its former parent.
      const position = isFocusRoot ? { x: 0, y: 0 } : { x: c.x, y: c.y }
      // Also: when a leaf becomes the focus root, blow it up to a "detail card"
      // size so progressive disclosure (which is CSS-width-driven) can show tags,
      // description, metadata and repo link. We patch the display data, not the DB.
      const isLeafFocus = isFocusRoot && !hasChildren[c.id]
      const displayW = isLeafFocus ? Math.max(c.width, 720) : c.width
      const displayH = isLeafFocus ? Math.max(c.height, 460) : c.height
      const displayComponent = isLeafFocus ? { ...c, width: displayW, height: displayH } : c
      return {
        id: c.id,
        type: 'component',
        position,
        data: { component: displayComponent, hasChildren: !!hasChildren[c.id] },
        parentNode,
        extent: parentNode ? 'parent' : undefined,
        selected: selectedId === c.id,
        style: { width: displayW, height: displayH },
        // draggable parent nodes need this in RF for correct child clipping
        expandParent: false,
        zIndex: 100 - c.level,
      } as Node
    })

    const visibleIds = new Set(visibleComponents.map((c) => c.id))
    const rfEdges: Edge[] = connections
      .filter((c) => visibleIds.has(c.sourceId) && visibleIds.has(c.targetId))
      .map((c) => ({
        id: c.id,
        source: c.sourceId,
        target: c.targetId,
        sourceHandle: c.sourceId + '-s',
        targetHandle: c.targetId + '-t',
        animated: c.kind === 'calls' || c.kind === 'depends_on',
        label: c.label || (c.kind !== 'uses' ? c.kind : undefined),
        style: { strokeDasharray: c.kind === 'depends_on' ? '4 4' : undefined },
      }))

    return { rfNodes, rfEdges, rootParent }
  }, [visibleComponents, components, connections, focusRootId, selectedId])

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges)

  useEffect(() => {
    setNodes(rfNodes)
  }, [rfNodes, setNodes])
  useEffect(() => {
    setEdges(rfEdges)
  }, [rfEdges, setEdges])

  // Re-fit the viewport whenever the focused subtree changes so semantic zoom picks
  // the right level. Since rfNodes is already filtered to the visible subtree,
  // fitView() (no args) fits exactly those.
  const lastFitTargetRef = useRef<string>('__pending__')
  useEffect(() => {
    if (!rfNodes.length) return
    const target = focusRootId ?? '__all__'
    if (lastFitTargetRef.current === target) return
    // Two rAFs give React Flow time to lay out nodes + measure dimensions.
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        rf.fitView({ duration: 400, padding: 0.08, maxZoom: 2.5 })
        lastFitTargetRef.current = target
      })
      ;(cleanup as any).raf2 = raf2
    })
    const cleanup: any = { raf1 }
    return () => {
      cancelAnimationFrame(cleanup.raf1)
      if (cleanup.raf2) cancelAnimationFrame(cleanup.raf2)
    }
  }, [focusRootId, rfNodes, rf])

  // Debounce position updates so drag+resize hit the API once per gesture.
  const pending = useRef<Map<string, { x: number; y: number; width?: number; height?: number }>>(new Map())
  const timer = useRef<number | null>(null)
  const flush = useCallback(() => {
    const p = pending.current
    pending.current = new Map()
    timer.current = null
    for (const [id, pos] of p) {
      api.positionComponent(id, pos.x, pos.y, pos.width, pos.height).catch(() => {})
    }
    if (p.size) qc.invalidateQueries({ queryKey: ['components'] })
  }, [qc])

  const handleNodesChange = (chgs: NodeChange[]) => {
    onNodesChange(chgs)
    let posChanges = 0
    for (const ch of chgs) {
      if (ch.type === 'position' && ch.position && !ch.dragging) {
        pending.current.set(ch.id, { ...(pending.current.get(ch.id) || { x: 0, y: 0 }), x: ch.position.x, y: ch.position.y })
        posChanges++
      }
      if (ch.type === 'dimensions' && ch.dimensions) {
        const nd = nodes.find((n) => n.id === ch.id)
        if (nd)
          pending.current.set(ch.id, {
            x: nd.position.x,
            y: nd.position.y,
            width: ch.dimensions.width,
            height: ch.dimensions.height,
          })
        posChanges++
      }
      if (ch.type === 'select' && ch.selected) select(ch.id)
    }
    if (posChanges) {
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, 250)
    }
  }

  const createConn = useMutation({
    mutationFn: (c: Partial<Connection>) => api.createConnection(c),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  })

  const onConnect = (c: RFConnection) => {
    if (!c.source || !c.target) return
    createConn.mutate({ sourceId: c.source, targetId: c.target, kind: 'uses' })
  }

  const focusParent = focusRootId ? components.find((c) => c.id === focusRootId)?.parentId ?? null : null

  return (
    <div className="w-full h-full relative">
      {focusRootId && (
        <div className="absolute z-10 top-3 left-3 flex items-center gap-2">
          <button
            className="btn"
            onClick={() => focusOn(focusParent)}
          >
            {focusParent ? '↑ Up one level' : '↑ Show all cities'}
          </button>
          <span className="text-sm text-subink">
            Viewing: <span className="text-ink font-medium">
              {components.find((c) => c.id === focusRootId)?.name}
            </span>
          </span>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={() => select(null)}
        onNodeClick={(_, n) => select(n.id)}
        onNodeDoubleClick={(_, n) => focusOn(n.id)}
        minZoom={0.05}
        maxZoom={2.5}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#22304d" />
        <Controls onFitView={() => rf.fitView({ duration: 400 })} />
        <MiniMap
          nodeColor={(n) => (n.data as any)?.component?.color || '#334155'}
          nodeStrokeColor="#0b1220"
          maskColor="rgba(4, 10, 20, 0.55)"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  )
}
