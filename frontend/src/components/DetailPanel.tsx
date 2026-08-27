import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Component } from '../types'
import { useUI } from '../store'
import ReactMarkdown from 'react-markdown'
import { COLOR_BY_LEVEL, TYPE_BY_LEVEL } from '../types'
import { Focus, Save, X } from 'lucide-react'

export function DetailPanel({ components }: { components: Component[] }) {
  const qc = useQueryClient()
  const { selectedId, select, focusOn } = useUI()
  const c = useMemo(() => components.find((x) => x.id === selectedId) || null, [components, selectedId])
  const parent = useMemo(
    () => (c?.parentId ? components.find((x) => x.id === c.parentId) : null),
    [components, c],
  )

  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [color, setColor] = useState('#334155')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState('')
  const [showRaw, setShowRaw] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!c) return
    setName(c.name)
    setType(c.type || TYPE_BY_LEVEL[c.level] || '')
    setColor(c.color || COLOR_BY_LEVEL[c.level] || '#334155')
    setDescription(c.description || '')
    setNotes(c.notes || '')
    const t = c.metadata?.tags
    setTags(Array.isArray(t) ? t.join(', ') : '')
    setDirty(false)
  }, [c?.id, c?.updatedAt])

  const patch = useMutation({
    mutationFn: (p: Partial<Component>) => api.patchComponent(c!.id, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['components'] })
      setDirty(false)
    },
  })

  const move = useMutation({
    mutationFn: (parentId: string | null) => api.moveComponent(c!.id, parentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['components'] }),
  })

  if (!c) return null

  const save = () => {
    const meta = { ...(c.metadata || {}) }
    if (tags.trim()) meta.tags = tags.split(',').map((t) => t.trim()).filter(Boolean)
    else delete meta.tags
    patch.mutate({
      name: name.trim() || c.name,
      type: type.trim(),
      color,
      description,
      notes,
      metadata: meta,
    })
  }

  const eligibleParents = components.filter(
    (p) => p.id !== c.id && !isDescendant(components, c.id, p.id),
  )

  return (
    <aside className="w-[380px] border-l border-line bg-panel/60 flex flex-col">
      <div className="h-12 flex items-center justify-between px-3 border-b border-line">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-3 h-3 rounded-sm" style={{ background: c.color || '#334155' }} />
          <div className="truncate font-medium">{c.name}</div>
          <span className="chip">L{c.level}</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn !py-1 !px-2" onClick={() => focusOn(c.id)} title="Focus canvas">
            <Focus size={12} />
          </button>
          <button className="btn !py-1 !px-2" onClick={() => select(null)} title="Close">
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="overflow-auto flex-1 p-3 space-y-3">
        <label className="field">
          Name
          <input value={name} onChange={(e) => { setName(e.target.value); setDirty(true) }} />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="field">
            Type
            <input value={type} onChange={(e) => { setType(e.target.value); setDirty(true) }} />
          </label>
          <label className="field">
            Color
            <input type="color" value={color} onChange={(e) => { setColor(e.target.value); setDirty(true) }} />
          </label>
        </div>

        <label className="field">
          Parent
          <select
            value={c.parentId || ''}
            onChange={(e) => move.mutate(e.target.value || null)}
          >
            <option value="">— (root city)</option>
            {eligibleParents.map((p) => (
              <option key={p.id} value={p.id}>
                {breadcrumb(components, p)}
              </option>
            ))}
          </select>
          {parent && <span className="text-[11px] text-subink">Currently under: {breadcrumb(components, parent)}</span>}
        </label>

        <label className="field">
          Description
          <textarea
            rows={3}
            value={description}
            onChange={(e) => { setDescription(e.target.value); setDirty(true) }}
            style={{ minHeight: 68 }}
          />
        </label>

        <label className="field">
          Tags (comma-separated)
          <input value={tags} onChange={(e) => { setTags(e.target.value); setDirty(true) }} placeholder="revenue, customer-facing" />
        </label>

        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-subink uppercase tracking-wide">Notes (markdown)</div>
            <button className="btn !py-0.5 !px-2 text-[11px]" onClick={() => setShowRaw((r) => !r)}>
              {showRaw ? 'Preview' : 'Edit'}
            </button>
          </div>
          {showRaw ? (
            <textarea
              className="w-full bg-panel2 border border-line rounded-md p-2 text-sm text-ink font-mono focus:outline-none focus:border-accent"
              rows={10}
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setDirty(true) }}
              placeholder="# Title&#10;- bullet&#10;- ..."
            />
          ) : (
            <div className="prose-notes bg-panel2 border border-line rounded-md p-3 min-h-[120px]">
              {notes ? <ReactMarkdown>{notes}</ReactMarkdown> : (
                <span className="text-subink italic">No notes yet. Click Edit.</span>
              )}
            </div>
          )}
        </div>

        <details>
          <summary className="text-xs text-subink cursor-pointer">Metadata (raw JSON)</summary>
          <pre className="text-[11px] mt-1 p-2 bg-panel2 rounded-md border border-line overflow-auto">
{JSON.stringify(c.metadata || {}, null, 2)}
          </pre>
        </details>
      </div>

      <div className="p-2 border-t border-line flex gap-2">
        <button
          className="btn btn-primary flex-1 justify-center"
          onClick={save}
          disabled={!dirty || patch.isPending}
        >
          <Save size={14} /> {patch.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </aside>
  )
}

function breadcrumb(all: Component[], c: Component): string {
  const parts: string[] = []
  let cur: Component | undefined = c
  while (cur) {
    parts.unshift(cur.name)
    cur = cur.parentId ? all.find((x) => x.id === cur!.parentId) : undefined
  }
  return parts.join(' / ')
}

function isDescendant(all: Component[], ancestorId: string, candidateId: string): boolean {
  let cur = all.find((x) => x.id === candidateId)
  while (cur) {
    if (cur.id === ancestorId) return true
    cur = cur.parentId ? all.find((x) => x.id === cur!.parentId) : undefined
  }
  return false
}
