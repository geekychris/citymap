#!/usr/bin/env node
/**
 * CityMap MCP server — exposes the CityMap REST API as MCP tools over stdio.
 *
 * Configure your MCP client (Claude Desktop, Claude Code) with:
 *   {
 *     "mcpServers": {
 *       "citymap": {
 *         "command": "node",
 *         "args": ["/absolute/path/to/citymap/mcp-server/index.js"],
 *         "env": { "CITYMAP_API": "http://localhost:8088" }
 *       }
 *     }
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const API = process.env.CITYMAP_API || 'http://localhost:8088'

async function apiCall(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text}`)
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

const TOOLS = [
  {
    name: 'list_components',
    description:
      'List all components in the city map. Optionally filter by parentId (empty string for roots) to narrow the set.',
    inputSchema: {
      type: 'object',
      properties: {
        parentId: { type: 'string', description: 'Parent component ID. Empty string for root/city components.' },
      },
    },
  },
  {
    name: 'get_component',
    description: 'Get a single component by ID, including its metadata and notes.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'get_subtree',
    description:
      'Get the full subtree rooted at a component (including the root). Use this to inspect a city, district, or building recursively.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'create_component',
    description:
      'Create a new component. If parentId is given, the level is auto-derived. Type defaults follow the TOGAF city convention: L0=CITY, L1=DISTRICT, L2=NEIGHBORHOOD, L3=BUILDING, L4=ROOM.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        parentId: { type: 'string', description: 'Parent component ID (omit for a new root city).' },
        type: { type: 'string' },
        level: { type: 'integer' },
        description: { type: 'string' },
        notes: { type: 'string', description: 'Markdown notes.' },
        color: { type: 'string' },
        x: { type: 'number' }, y: { type: 'number' },
        width: { type: 'number' }, height: { type: 'number' },
        metadata: { type: 'object', description: 'Arbitrary JSON metadata (tags, owner, links, tech stack).' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_component',
    description: 'Patch fields on an existing component. Only fields you pass are updated.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        type: { type: 'string' },
        level: { type: 'integer' },
        description: { type: 'string' },
        notes: { type: 'string' },
        color: { type: 'string' },
        metadata: { type: 'object' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_component',
    description: 'Delete a component and its entire subtree (cascade).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'move_component',
    description: 'Reparent a component. Pass parentId as empty string to move to root.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        parentId: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'search_components',
    description: 'Search components by name, description, notes, or metadata (case-insensitive).',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string' },
        type: { type: 'string' },
        level: { type: 'integer' },
        limit: { type: 'integer', default: 50 },
      },
      required: ['q'],
    },
  },
  {
    name: 'add_connection',
    description:
      'Add a dependency/link between two components (dependency edge on the canvas). Common kinds: uses, depends_on, calls, publishes_to.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceId: { type: 'string' },
        targetId: { type: 'string' },
        kind: { type: 'string' },
        label: { type: 'string' },
      },
      required: ['sourceId', 'targetId'],
    },
  },
  {
    name: 'delete_connection',
    description: 'Remove a connection by id.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'list_connections',
    description: 'List all connections. Optionally filter to those touching a specific componentId.',
    inputSchema: {
      type: 'object',
      properties: { componentId: { type: 'string' } },
    },
  },
  {
    name: 'export_city',
    description: 'Export the whole city (components + connections) as a JSON blob for backup or sharing.',
    inputSchema: { type: 'object', properties: {} },
  },
]

const HANDLERS = {
  list_components: async ({ parentId }) => {
    const q = parentId === undefined ? '' : `?parentId=${encodeURIComponent(parentId)}`
    return apiCall(`/api/components${q}`)
  },
  get_component: ({ id }) => apiCall(`/api/components/${id}`),
  get_subtree: ({ id }) => apiCall(`/api/components/${id}/subtree`),
  create_component: (input) =>
    apiCall(`/api/components`, { method: 'POST', body: JSON.stringify(input) }),
  update_component: ({ id, ...patch }) =>
    apiCall(`/api/components/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  delete_component: async ({ id }) => {
    await apiCall(`/api/components/${id}`, { method: 'DELETE' })
    return { deleted: id }
  },
  move_component: ({ id, parentId }) =>
    apiCall(`/api/components/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ parentId: parentId ?? '' }),
    }),
  search_components: ({ q, type, level, limit = 50 }) => {
    const p = new URLSearchParams({ q, limit: String(limit) })
    if (type) p.set('type', type)
    if (level !== undefined) p.set('level', String(level))
    return apiCall(`/api/search?${p}`)
  },
  add_connection: (input) =>
    apiCall(`/api/connections`, { method: 'POST', body: JSON.stringify(input) }),
  delete_connection: async ({ id }) => {
    await apiCall(`/api/connections/${id}`, { method: 'DELETE' })
    return { deleted: id }
  },
  list_connections: ({ componentId } = {}) => {
    const q = componentId ? `?componentId=${encodeURIComponent(componentId)}` : ''
    return apiCall(`/api/connections${q}`)
  },
  export_city: () => apiCall(`/api/export`),
}

const server = new Server(
  { name: 'citymap', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params
  const handler = HANDLERS[name]
  if (!handler) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    }
  }
  try {
    const result = await handler(args)
    return {
      content: [
        { type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) },
      ],
    }
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Error: ${err.message}` }],
    }
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)
process.stderr.write(`citymap-mcp connected (API=${API})\n`)
