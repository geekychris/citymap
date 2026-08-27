import { memo, useEffect, useRef, useState } from 'react'
import { Handle, NodeResizer, Position, useReactFlow, useStore } from 'reactflow'
import type { Component } from '../types'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { ExternalLink, Plus, Star } from 'lucide-react'
import { useUI } from '../store'

interface Data {
  component: Component
  hasChildren: boolean
}

/**
 * Per-level typographic scale — tuned so the LARGEST containers stay readable when
 * fitView zooms the whole city to ~0.15, and the smallest leaves don't overflow
 * when they're only ~120px wide. Font sizes are in "world" px; React Flow scales
 * them by the current zoom transform.
 */
const HEADER_STYLE: Record<number, { fontSize: number; padY: number; padX: number; badgeSize: number }> = {
  0: { fontSize: 48, padY: 16, padX: 22, badgeSize: 14 },  // CITY
  1: { fontSize: 30, padY: 12, padX: 18, badgeSize: 12 },  // DISTRICT
  2: { fontSize: 20, padY: 8,  padX: 14, badgeSize: 10 },  // NEIGHBORHOOD
  3: { fontSize: 13, padY: 6,  padX: 10, badgeSize: 9  },  // BUILDING
  4: { fontSize: 12, padY: 5,  padX: 9,  badgeSize: 9  },  // ROOM
}

function ComponentNodeInner({ data, selected, id }: { data: Data; selected: boolean; id: string }) {
  const qc = useQueryClient()
  const { component: c, hasChildren } = data
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(c.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const rf = useReactFlow()
  const focusOn = useUI((s) => s.focusOn)

  // Current viewport zoom — reactive; drives progressive disclosure.
  const zoom = useStore((s) => s.transform[2])
  // How large this node currently is on the user's screen (px).
  const screenW = c.width * zoom
  const screenH = c.height * zoom

  const patch = useMutation({
    mutationFn: (p: Partial<Component>) => api.patchComponent(c.id, p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['components'] }),
  })

  const addChild = useMutation({
    mutationFn: () =>
      api.createComponent({
        name: 'New component',
        parentId: c.id,
        level: c.level + 1,
        x: 20 + Math.random() * 80,
        y: 40 + Math.random() * 80,
        width: 220,
        height: 140,
      }),
    onSuccess: (child) => {
      qc.invalidateQueries({ queryKey: ['components'] })
      setTimeout(() => rf.fitView({ duration: 300, nodes: [{ id: child.id }] }), 60)
    },
  })

  useEffect(() => {
    if (editing) {
      setDraft(c.name)
      requestAnimationFrame(() => inputRef.current?.select())
    }
  }, [editing, c.name])

  const commit = () => {
    setEditing(false)
    if (draft.trim() && draft !== c.name) patch.mutate({ name: draft.trim() })
  }

  const bg = c.color || '#334155'
  const level = Math.max(0, Math.min(4, c.level))
  const style = HEADER_STYLE[level]

  // Progressive disclosure.
  //   `screenSize` — how many pixels the node occupies on the *user's screen right now*.
  //   `w`/`h`     — the node's world (CSS) size, which is what flex layout actually works in.
  //
  // Rules:
  //   * screenSize thresholds guard against rendering anything unreadable — if the
  //     node is only a few pixels tall on screen, don't bother.
  //   * w/h thresholds decide what fits inside the container so the title never
  //     gets squeezed to zero width by a badge / stars chip / plus button.
  //   * TITLE ALWAYS WINS. Chips only render when there is measurable room next
  //     to a legible title.
  const w = c.width
  const h = c.height
  const readable  = screenW >= 30 && screenH >= 16
  const showTitle    = readable
  // The importer guarantees buildings ≥ 280×190; thresholds tuned so a stock
  // building shows title + description + tags + language chip + repo link.
  const showBadge    = readable && w >= 340                 // districts/city only
  const showStars    = readable && w >= 260 && level >= 3
  const showControls = readable && w >= 220 && h >= 55
  const showBody     = readable && !hasChildren && w >= 200 && h >= 100
  const showTags     = readable && !hasChildren && w >= 240 && h >= 140
  const showMeta     = readable && !hasChildren && w >= 260 && h >= 170
  const showLink     = readable && !hasChildren && w >= 220 && h >= 80

  // Container nodes get a much lower body opacity so children read clearly.
  const containerFade = hasChildren ? 0.15 : 0.55

  const stars = c.metadata?.stars as number | undefined
  const repoUrl = c.metadata?.url as string | undefined
  const tags = Array.isArray(c.metadata?.tags) ? (c.metadata!.tags as string[]) : []

  return (
    <div
      className={`rf-node ${selected ? 'selected' : ''}`}
      style={{
        width: '100%',
        height: '100%',
        background: `linear-gradient(180deg, ${hexA(bg, containerFade * 0.5)}, ${hexA(bg, containerFade)})`,
        display: 'flex',
        flexDirection: 'column',
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        focusOn(c.id)
      }}
    >
      <NodeResizer
        color="#38bdf8"
        isVisible={selected}
        minWidth={80}
        minHeight={50}
        onResizeEnd={(_, params) => {
          patch.mutate({ x: params.x, y: params.y, width: params.width, height: params.height })
        }}
      />
      <Handle type="target" position={Position.Left} id={id + '-t'} />
      <Handle type="source" position={Position.Right} id={id + '-s'} />

      {/* Header — level-appropriate size so it's readable even when zoomed out */}
      {showTitle && (
        <div
          className="rf-head"
          style={{
            padding: `${style.padY}px ${style.padX}px`,
            fontSize: style.fontSize,
            lineHeight: 1.15,
            background: hexA(bg, 0.65),
            display: 'flex',
            alignItems: 'center',
            gap: Math.max(6, style.padX * 0.5),
            flexShrink: 0,
          }}
        >
          {showBadge && (
            <span className="rf-badge" style={{ fontSize: style.badgeSize, padding: `2px ${style.badgeSize * 0.6}px` }}>
              {c.type || `L${c.level}`}
            </span>
          )}
          {editing ? (
            <input
              ref={inputRef}
              className="rf-title-input"
              style={{ fontSize: style.fontSize, minWidth: 0 }}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') setEditing(false)
              }}
            />
          ) : (
            <span
              className="rf-title"
              style={{
                flex: '1 1 0%',
                minWidth: 0,                 // <— critical: lets ellipsis kick in inside a flex row
                fontSize: style.fontSize,
                fontWeight: level <= 1 ? 700 : 600,
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                setEditing(true)
              }}
              title="Double-click to rename"
            >
              {c.name}
            </span>
          )}
          {showStars && typeof stars === 'number' && (
            <span className="rf-badge" style={{ fontSize: style.badgeSize, padding: `2px ${style.badgeSize * 0.6}px` }}>
              <Star size={style.badgeSize} /> {stars}
            </span>
          )}
          {showControls && (
            <button
              className="p-1 rounded hover:bg-white/10"
              title="Add child"
              style={{ flexShrink: 0 }}
              onClick={(e) => {
                e.stopPropagation()
                addChild.mutate()
              }}
            >
              <Plus size={Math.max(12, style.fontSize * 0.55)} />
            </button>
          )}
        </div>
      )}

      {/* Body content — only rendered when the node is big enough to fit it */}
      {(showBody || showTags || showMeta || showLink) && (
        <div
          className="rf-body flex flex-col gap-1 overflow-hidden"
          style={{
            padding: `${style.padY * 0.6}px ${style.padX}px`,
            flex: 1,
            minHeight: 0,
          }}
        >
          {showBody && c.description && (
            <div
              className="text-slate-200/85 overflow-hidden"
              style={{
                fontSize: level === 3 ? 12 : 13,
                lineHeight: 1.35,
                display: '-webkit-box',
                WebkitLineClamp: showMeta ? 4 : 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {c.description}
            </div>
          )}
          {showTags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, showMeta ? 6 : 3).map((t) => (
                <span key={t} className="chip" style={{ fontSize: 11 }}>{t}</span>
              ))}
            </div>
          )}
          {showMeta && level >= 3 && (
            <div className="flex items-center gap-2 text-slate-300/80" style={{ fontSize: 11 }}>
              {c.metadata?.language && (
                <span className="chip" style={{ fontSize: 11, background: hexA(bg, 0.4) }}>
                  {c.metadata.language as string}
                </span>
              )}
              {c.metadata?.license && (
                <span className="chip" style={{ fontSize: 11 }}>{c.metadata.license as string}</span>
              )}
            </div>
          )}
          {showLink && repoUrl && (
            <a
              className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200 mt-auto"
              style={{ fontSize: 11 }}
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={11} /> {repoUrl.replace(/^https?:\/\/(www\.)?/, '')}
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function hexA(hex: string, a: number) {
  const h = hex.replace('#', '')
  const b = h.length === 3
    ? h.split('').map((c) => c + c).join('')
    : h
  const r = parseInt(b.slice(0, 2), 16)
  const g = parseInt(b.slice(2, 4), 16)
  const bl = parseInt(b.slice(4, 6), 16)
  return `rgba(${r},${g},${bl},${a})`
}

export const ComponentNode = memo(ComponentNodeInner)
