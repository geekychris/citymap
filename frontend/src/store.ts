import { create } from 'zustand'

interface UI {
  selectedId: string | null
  select: (id: string | null) => void
  focusRootId: string | null
  focusOn: (id: string | null) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
}

export const useUI = create<UI>((set) => ({
  selectedId: null,
  select: (id) => set({ selectedId: id }),
  focusRootId: null,
  focusOn: (id) => set({ focusRootId: id, selectedId: id }),
  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}))
