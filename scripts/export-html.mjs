#!/usr/bin/env node
/**
 * Export the current CityMap as a single self-contained HTML file.
 *
 *   node scripts/export-html.mjs [--api URL] [--out FILE] [--title NAME]
 *
 * Defaults:
 *   --api   http://localhost:8088
 *   --out   ./citymap-<timestamp>.html
 *   --title first CITY's name if there's exactly one, else "CityMap"
 *
 * With no --out, writes to stdout instead of a file.
 */

import fs from 'node:fs'
import { renderHtmlExport } from './lib/render-html-export.mjs'

const argv = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, ...rest] = a.replace(/^--/, '').split('=')
      return [k, rest.length ? rest.join('=') : true]
    })
)

const API = argv.api || process.env.CITYMAP_API || 'http://localhost:8088'
const outPath = argv.out === true
  ? `./citymap-${new Date().toISOString().replace(/[:.]/g, '-')}.html`
  : (argv.out || null)

async function main() {
  const r = await fetch(`${API}/api/export`)
  if (!r.ok) throw new Error(`GET ${API}/api/export -> ${r.status} ${await r.text()}`)
  const payload = await r.json()
  const roots = (payload.components || []).filter((c) => !c.parentId)
  const cityName = argv.title || (roots.length === 1 ? roots[0].name : 'CityMap')

  const html = renderHtmlExport({
    components: payload.components || [],
    connections: payload.connections || [],
    cityName,
  })

  if (outPath) {
    fs.writeFileSync(outPath, html, 'utf8')
    const sizeKb = Math.round(html.length / 1024)
    console.error(`✓ wrote ${outPath} (${sizeKb} KB, ${(payload.components || []).length} components, ${(payload.connections || []).length} connections)`)
  } else {
    process.stdout.write(html)
  }
}

main().catch((err) => {
  console.error('✗', err.message)
  process.exit(1)
})
