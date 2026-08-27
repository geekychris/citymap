import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Component } from '../types'
import { ChevronRight, ChevronDown, Search, X, Focus } from 'lucide-react'
import { useUI } from '../store'
import clsx from 'clsx'

export function Sidebar({ components }: { components: Component[] }) {
  const qc = useQueryClient()
  const { selectedId, select, focusOn, searchQuery, setSearchQuery } = useUI()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const roots = useMemo(() => components.filter((c) => !c.parentId), [components])
  const childrenByParent = useMemo(() => {
    const m: Record<string, Component[]> = {}
    for (const c of components) {
      if (c.parentId) (m[c.parentId] ||= []).push(c)
    }
    for (const k of Object.keys(m)) m[k].sort((a, b) => a.name.localeCompare(b.name))
    return m
  }, [components])

  const matchedIds = useMemo(() => {
    if (!searchQuery.trim()) return null
    const q = searchQuery.toLowerCase()
    const matched = new Set<string>()
    for (const c of components) {
      if (
        c.name.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q) ||
        (c.notes || '').toLowerCase().includes(q) ||
        JSON.stringify(c.metadata || {}).toLowerCase().includes(q)
      ) {
        matched.add(c.id)
        // include ancestors so tree can display them
        let p = c.parentId
        while (p) {
          matched.add(p)
          const parent = components.find((x) => x.id === p)
          p = parent?.parentId || null
        }
      }
    }
    return matched
  }, [components, searchQuery])

  const del = useMutation({
    mutationFn: (id: string) => api.deleteComponent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['components'] })
      qc.invalidateQueries({ queryKey: ['connections'] })
      select(null)
    },
  })

  const renderNode = (c: Component, depth: number) => {
    if (matchedIds && !matchedIds.has(c.id)) return null
    const kids = childrenByParent[c.id] || []
    const isOpen = expanded[c.id] ?? (matchedIds ? true : depth === 0)
    return (
      <div key={c.id}>
        <div
          className={clsx(
            'tree-row flex items-center gap-1 pr-2 py-1 text-sm rounded',
            selectedId === c.id && 'selected',
          )}
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => select(c.id)}
          onDoubleClick={() => focusOn(c.id)}
        >
          {kids.length ? (
            <button
              className="p-0.5 rounded hover:bg-white/10"
              onClick={(e) => {
                e.stopPropagation()
                setExpanded((s) => ({ ...s, [c.id]: !isOpen }))
              }}
            >
              {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : (
            <span className="w-[16px]" />
          )}
          <span
            className="w-2 h-2 rounded-sm flex-shrink-0"
            style={{ background: c.color || '#64748b' }}
          />
          <span className="truncate flex-1">{c.name}</span>
          <span className="text-[10px] text-subink">L{c.level}</span>
          <button
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded"
            onClick={(e) => {
              e.stopPropagation()
              focusOn(c.id)
            }}
            title="Focus on canvas"
          >
            <Focus size={11} />
          </button>
        </div>
        {isOpen && kids.map((k) => renderNode(k, depth + 1))}
      </div>
    )
  }

  return (
    <aside className="w-72 border-r border-line bg-panel/60 flex flex-col">
      <div className="p-2 border-b border-line">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subink" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search components, notes, tags…"
            className="w-full bg-panel2 border border-line rounded-md pl-8 pr-8 py-1.5 text-sm text-ink focus:outline-none focus:border-accent"
          />
          {searchQuery && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-subink hover:text-ink"
              onClick={() => setSearchQuery('')}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto py-1">
        {roots.length === 0 && (
          <div className="p-4 text-sm text-subink">
            No cities yet. Click <strong>New City</strong> above.
          </div>
        )}
        {roots.map((r) => renderNode(r, 0))}
      </div>
      {selectedId && (
        <div className="p-2 border-t border-line">
          <button
            className="btn btn-danger w-full justify-center"
            onClick={() => {
              if (confirm('Delete component and all children?')) del.mutate(selectedId)
            }}
          >
            Delete selected
          </button>
        </div>
      )}
    </aside>
  )
}
