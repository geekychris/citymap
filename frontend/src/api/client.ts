import type { Component, Connection } from '../types'

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const r = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
  })
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    throw new Error(`${r.status} ${r.statusText}: ${body}`)
  }
  if (r.status === 204) return undefined as unknown as T
  return r.json()
}

export const api = {
  listComponents: (): Promise<Component[]> => req('/api/components'),
  getComponent:   (id: string): Promise<Component> => req(`/api/components/${id}`),
  subtree:        (id: string): Promise<Component[]> => req(`/api/components/${id}/subtree`),
  createComponent:(c: Partial<Component>): Promise<Component> =>
    req('/api/components', { method: 'POST', body: JSON.stringify(c) }),
  patchComponent: (id: string, patch: Partial<Component>): Promise<Component> =>
    req(`/api/components/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteComponent:(id: string): Promise<void> =>
    req(`/api/components/${id}`, { method: 'DELETE' }),
  positionComponent: (id: string, x: number, y: number, width?: number, height?: number) =>
    req(`/api/components/${id}/position`, {
      method: 'PATCH', body: JSON.stringify({ x, y, width, height }),
    }),
  moveComponent:  (id: string, parentId: string | null): Promise<Component> =>
    req(`/api/components/${id}/move`, {
      method: 'POST', body: JSON.stringify({ parentId: parentId ?? '' }),
    }),
  search: (q: string): Promise<Component[]> =>
    req(`/api/search?q=${encodeURIComponent(q)}&limit=100`),

  listConnections: (): Promise<Connection[]> => req('/api/connections'),
  createConnection:(c: Partial<Connection>): Promise<Connection> =>
    req('/api/connections', { method: 'POST', body: JSON.stringify(c) }),
  deleteConnection:(id: string): Promise<void> =>
    req(`/api/connections/${id}`, { method: 'DELETE' }),

  exportAll: (): Promise<{ components: Component[]; connections: Connection[] }> =>
    req('/api/export'),
}
