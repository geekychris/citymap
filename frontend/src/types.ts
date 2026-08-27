export interface Component {
  id: string
  parentId?: string | null
  name: string
  type: string
  level: number
  x: number
  y: number
  width: number
  height: number
  color?: string | null
  icon?: string | null
  description?: string | null
  notes?: string | null
  metadata?: Record<string, any> | null
  createdAt?: string
  updatedAt?: string
}

export interface Connection {
  id: string
  sourceId: string
  targetId: string
  kind: string
  label?: string | null
  metadata?: Record<string, any> | null
  createdAt?: string
}

export const TYPE_BY_LEVEL: Record<number, string> = {
  0: 'CITY',
  1: 'DISTRICT',
  2: 'NEIGHBORHOOD',
  3: 'BUILDING',
  4: 'ROOM',
}

export const COLOR_BY_LEVEL: Record<number, string> = {
  0: '#0f172a',
  1: '#1e3a8a',
  2: '#0369a1',
  3: '#0891b2',
  4: '#0d9488',
}
