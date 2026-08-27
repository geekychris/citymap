#!/usr/bin/env node
/**
 * Generate a placeholder template of the exported HTML and drop it into the
 * backend's classpath resources. The backend endpoint reads that template and
 * substitutes __CITYMAP_DATA__ with the current export payload.
 *
 * Run this whenever you edit scripts/lib/render-html-export.mjs.
 *
 *   node scripts/gen-backend-template.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderHtmlExport } from './lib/render-html-export.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '..', 'backend', 'src', 'main', 'resources', 'export')
const outPath = path.join(outDir, 'city-template.html')

fs.mkdirSync(outDir, { recursive: true })

// Render with a marker payload; then replace the volatile bits with markers the
// backend controller substitutes at request time.
const html = renderHtmlExport({
  components: [],
  connections: [],
  cityName: '__CITYMAP_TITLE__',
})
const patched = html
  // Data payload
  .replace(/const DATA = \{[^;]*\};/, 'const DATA = __CITYMAP_DATA__;')
  // Header counts + timestamp
  .replace(/ · 0 components · 0 connections · [^<]*</,
           ' · __CITYMAP_COMPONENT_COUNT__ components · __CITYMAP_CONNECTION_COUNT__ connections · __CITYMAP_GENERATED_AT__<')

fs.writeFileSync(outPath, patched, 'utf8')
console.error(`✓ wrote ${outPath} (${Math.round(patched.length / 1024)} KB)`)
