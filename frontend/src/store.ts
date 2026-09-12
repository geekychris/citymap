import { create } from 'zustand'

export type ViewMode = 'city' | 'blueprint' | 'wireframe'

interface UI {
  selectedId: string | null
  select: (id: string | null) => void
  focusRootId: string | null
  focusOn: (id: string | null) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  viewMode: ViewMode
  setViewMode: (m: ViewMode) => void
  showEdges: boolean
  setShowEdges: (v: boolean) => void
}

const initialMode = ((): ViewMode => {
  if (typeof window === 'undefined') return 'city'
  const q = new URL(window.location.href).searchParams.get('mode')
  return q === 'blueprint' || q === 'wireframe' ? q : 'city'
})()

const initialShowEdges = ((): boolean => {
  if (typeof window === 'undefined') return true
  const q = new URL(window.location.href).searchParams.get('edges')
  return q !== 'off'
})()

export const useUI = create<UI>((set) => ({
  selectedId: null,
  select: (id) => set({ selectedId: id }),
  focusRootId: null,
  focusOn: (id) => set({ focusRootId: id, selectedId: id }),
  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  viewMode: initialMode,
  setViewMode: (viewMode) => set({ viewMode }),
  showEdges: initialShowEdges,
  setShowEdges: (showEdges) => set({ showEdges }),
}))
