#!/usr/bin/env node
/**
 * Puppeteer-driven e2e test that PROVES zooming reveals maximum detail on each
 * component level (city → district → neighborhood → building).
 *
 * For each level we pick one sample component, navigate to `?focus=<id>` (which
 * pans+zooms into that subtree), and assert that the DOM contains the slots
 * we expect at that level: title, badge, description, tags, language chip,
 * repo link, etc. Screenshots for each level are saved to /tmp/citymap-test-*.png.
 *
 *   node scripts/test-zoom-detail.mjs [--api URL] [--ui URL] [--chrome PATH]
 */

import puppeteer from 'puppeteer-core'

const argv = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, ...rest] = a.replace(/^--/, '').split('=')
      return [k, rest.length ? rest.join('=') : true]
    })
)

const API = argv.api || process.env.CITYMAP_API || 'http://localhost:8088'
const UI  = argv.ui  || process.env.CITYMAP_UI  || 'http://localhost:5174'
const CHROME = argv.chrome || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const RED = (s) => `\x1b[31m${s}\x1b[0m`
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`
const DIM = (s) => `\x1b[2m${s}\x1b[0m`

async function json(path) {
  const r = await fetch(`${API}${path}`)
  if (!r.ok) throw new Error(`${path} → ${r.status}`)
  return r.json()
}

/** Wait until React Flow's viewport transform reports the expected node in the DOM. */
async function waitForNode(page, nodeId, timeoutMs = 5000) {
  await page.waitForSelector(`.react-flow__node[data-id="${nodeId}"]`, { timeout: timeoutMs })
  // Extra frames for animation to settle
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}

/** Extract the RENDERED text content of a React Flow node's card. */
async function nodeContent(page, nodeId) {
  return page.evaluate((id) => {
    const el = document.querySelector(`.react-flow__node[data-id="${id}"] .rf-node`)
    if (!el) return null
    const head = el.querySelector('.rf-head')
    const body = el.querySelector('.rf-body')
    const badge = head?.querySelector('.rf-badge')
    const anchor = el.querySelector('a[href^="http"]')
    // find description div — first div inside body that has some text
    let description = ''
    if (body) {
      for (const child of body.children) {
        const t = (child.textContent || '').trim()
        if (t.length > 20 && !t.startsWith('#') && !child.querySelector('a')) {
          description = t
          break
        }
      }
    }
    const chipTexts = [...el.querySelectorAll('.chip, .rf-badge')].map((n) => n.textContent?.trim()).filter(Boolean)
    return {
      hasHeader: !!head,
      hasBody: !!body,
      badgeText: badge?.textContent?.trim() ?? null,
      titleText: head?.querySelector('.rf-title')?.textContent?.trim() ?? null,
      description,
      chips: chipTexts,
      linkHref: anchor?.getAttribute('href') ?? null,
      linkText: anchor?.textContent?.trim() ?? null,
      boundingRect: el.getBoundingClientRect(),
    }
  }, nodeId)
}

const cases = []
function testCase(name, fn) { cases.push({ name, fn }) }

async function main() {
  console.error(`> Loading components from ${API}…`)
  const all = await json('/api/components')
  if (!all.length) throw new Error('no components in the DB — run the importer first')

  const city         = all.find((c) => c.level === 0)
  const district     = all.find((c) => c.level === 1 && c.name === 'AI / LLM Tooling')
                       ?? all.find((c) => c.level === 1)
  const neighborhood = all.find((c) => c.parentId === district?.id) ?? all.find((c) => c.level === 2)
  const building     = all.find((c) => c.name === 'hitorro-retrieval')
                       ?? all.find((c) => c.level === 3)

  if (!city || !district || !neighborhood || !building) {
    throw new Error('missing one of: city / district / neighborhood / building')
  }

  console.error(`> Launching Chrome…`)
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-features=Translate,MediaRouter'],
    defaultViewport: { width: 1800, height: 1200 },
  })
  const page = await browser.newPage()
  page.setDefaultNavigationTimeout(30000)

  const results = []

  const run = async (label, expectId, expectations) => {
    process.stderr.write(`  · ${label.padEnd(40)} `)
    const url = `${UI}/?focus=${expectId}`
    await page.goto(url, { waitUntil: 'networkidle2' })
    await waitForNode(page, expectId)
    // Let fitView animation complete
    await new Promise((r) => setTimeout(r, 800))
    const info = await nodeContent(page, expectId)
    const problems = []
    for (const [slot, check] of Object.entries(expectations)) {
      const ok = check(info)
      if (!ok) problems.push(slot)
    }
    const shot = `/tmp/citymap-test-${label.replace(/[^\w]+/g, '_')}.png`
    await page.screenshot({ path: shot })
    if (problems.length === 0) {
      console.error(GREEN(`✓  (${shot})`))
      results.push({ label, ok: true, shot })
    } else {
      console.error(RED(`✗ missing: ${problems.join(', ')}`))
      console.error(DIM(`   ${shot}`))
      console.error(DIM(`   info=${JSON.stringify(info).slice(0, 300)}…`))
      results.push({ label, ok: false, problems, shot })
    }
  }

  await run('city', city.id, {
    title:       (i) => i.titleText === city.name,
    badge_CITY:  (i) => (i.badgeText || '').toUpperCase().includes('CITY') || i.chips.some((c) => c.includes('CITY')),
  })

  await run('district', district.id, {
    title:         (i) => i.titleText === district.name,
    badge_DISTRICT:(i) => (i.badgeText || '').toUpperCase().includes('DISTRICT') || i.chips.some((c) => c.includes('DISTRICT')),
  })

  await run('neighborhood', neighborhood.id, {
    title:            (i) => i.titleText === neighborhood.name,
    // Neighborhoods are big enough now to warrant a badge:
    badge_NEIGHBORHOOD: (i) => (i.badgeText || '').toUpperCase().includes('NEIGHBORHOOD') || i.chips.some((c) => c.includes('NEIGHBORHOOD')),
  })

  await run('building (default 280x190)', building.id, {
    title:       (i) => i.titleText === building.name,
    description: (i) => i.description && i.description.length > 30,
    tag_chip:    (i) => i.chips.some((c) => (building.metadata?.tags || []).includes(c)),
    lang_chip:   (i) => i.chips.some((c) => c === building.metadata?.language),
    repo_link:   (i) => i.linkHref && i.linkHref.includes('github.com'),
  })

  // ── Connectivity-aware ordering: for every connection whose endpoints share a
  // parent, measure how far apart the endpoints ended up in the grid (Chebyshev
  // distance between cells). Report totals + assert average <= 1.5 cells.
  const connections = await json('/api/connections')
  const byId = new Map(all.map((c) => [c.id, c]))
  const siblingsOf = (id) => all.filter((c) => c.parentId === id)
  const cellOf = (comp, siblings) => {
    // Guess the row/col from x/y: sort siblings by y (rows) then x (cols).
    const rowSize = 240 // approx: any y-gap wider than this counts as a new row
    const rows = []
    const sorted = [...siblings].sort((a, b) => a.y - b.y || a.x - b.x)
    let currentRow = []; let rowY = -Infinity
    for (const s of sorted) {
      if (s.y - rowY > rowSize / 2 && currentRow.length) { rows.push(currentRow); currentRow = [] }
      currentRow.push(s); rowY = s.y
    }
    if (currentRow.length) rows.push(currentRow)
    for (let r = 0; r < rows.length; r++) {
      rows[r].sort((a, b) => a.x - b.x)
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c].id === comp.id) return { row: r, col: c }
      }
    }
    return null
  }
  const distances = []
  for (const conn of connections) {
    const s = byId.get(conn.sourceId), t = byId.get(conn.targetId)
    if (!s || !t || s.parentId !== t.parentId) continue
    const sib = siblingsOf(s.parentId)
    const cs = cellOf(s, sib), ct = cellOf(t, sib)
    if (!cs || !ct) continue
    const d = Math.max(Math.abs(cs.row - ct.row), Math.abs(cs.col - ct.col))
    distances.push({ from: s.name, to: t.name, dist: d })
  }
  if (distances.length) {
    const avg = distances.reduce((a, d) => a + d.dist, 0) / distances.length
    const max = Math.max(...distances.map((d) => d.dist))
    const okAvg = avg <= 1.5
    const okMax = max <= 3
    const label = 'sibling-edge grid distance'
    process.stderr.write(`  · ${label.padEnd(40)} `)
    if (okAvg && okMax) {
      console.error(GREEN(`✓  avg=${avg.toFixed(2)}, max=${max}, n=${distances.length}`))
      results.push({ label, ok: true })
    } else {
      const worst = distances.sort((a, b) => b.dist - a.dist).slice(0, 5)
      console.error(RED(`✗ avg=${avg.toFixed(2)} (>${1.5}) or max=${max} (>${3})`))
      console.error(DIM(`   worst: ${worst.map((d) => `${d.from}→${d.to}=${d.dist}`).join(', ')}`))
      results.push({ label, ok: false, problems: ['ordering'], shot: null })
    }
  }

  await browser.close()

  const failed = results.filter((r) => !r.ok)
  if (failed.length) {
    console.error(RED(`\n✗ ${failed.length} of ${results.length} case(s) failed:\n`))
    for (const f of failed) console.error(`  - ${f.label}: missing ${f.problems.join(', ')}  → ${f.shot}`)
    process.exit(1)
  }
  console.error(GREEN(`\n✓ all ${results.length} zoom-detail cases pass`))
}

main().catch((err) => {
  console.error('✗', err.stack || err.message)
  process.exit(1)
})
