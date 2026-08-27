#!/usr/bin/env node
/**
 * Seed a city map from a GitHub user's repositories.
 *
 *   node scripts/import-github.mjs [username] [--api URL] [--city NAME] [--token TOKEN] \
 *     [--grouping FILE]
 *
 * Defaults: username=geekychris, api=http://localhost:8088
 *
 * With --grouping (or if scripts/groupings/<username>.json exists), the script builds a
 * PRODUCT-ORIENTED city:
 *   CITY: "<user> Portfolio"
 *     DISTRICT   (per product family — Hitorro, AmigaOS4, …)
 *       NEIGHBORHOOD (per subsystem inside a product)
 *         BUILDING  (per repo, with GitHub metadata attached)
 *     DISTRICT "Uncategorized" — repos not in the grouping, grouped by language
 *     + curated cross-repo dependency edges from the grouping file
 *
 * Without --grouping, falls back to grouping by primary language (technical view).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const argv = process.argv.slice(2)
const positional = argv.filter((a) => !a.startsWith('--'))
const kv = Object.fromEntries(
  argv
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, ...rest] = a.replace(/^--/, '').split('=')
      return [k, rest.length ? rest.join('=') : true]
    }),
)

const username = positional[0] || kv.user || 'geekychris'
const API = kv.api || process.env.CITYMAP_API || 'http://localhost:8088'
const token = kv.token || process.env.GITHUB_TOKEN

let groupingPath = kv.grouping
if (!groupingPath) {
  const guess = path.join(__dirname, 'groupings', `${username}.json`)
  if (fs.existsSync(guess)) groupingPath = guess
}
const grouping = groupingPath ? JSON.parse(fs.readFileSync(groupingPath, 'utf8')) : null

const cityName =
  kv.city || grouping?.cityName || `${username} Projects`

const LANG_COLORS = {
  JavaScript: '#f7df1e', TypeScript: '#3178c6', Python: '#3572a5', Java: '#b07219',
  Kotlin: '#a97bff', Go: '#00ADD8', Rust: '#dea584', C: '#555555', 'C++': '#f34b7d',
  'C#': '#178600', Ruby: '#701516', PHP: '#4F5D95', Swift: '#F05138', Shell: '#89e051',
  HTML: '#e34c26', CSS: '#563d7c', Scala: '#c22d40', Elixir: '#6e4a7e', Clojure: '#db5855',
  Dart: '#00B4AB', R: '#198CE7', Assembly: '#6E4C13', Vue: '#41b883', Svelte: '#ff3e00',
  '(unknown)': '#64748b',
}

async function ghFetch(url) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'citymap-importer' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`GitHub ${res.status} ${res.statusText}: ${await res.text()}`)
  return res.json()
}

async function apiCall(pathname, opts = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
  })
  if (!res.ok) throw new Error(`API ${res.status} ${res.statusText}: ${await res.text()}`)
  if (res.status === 204) return null
  return res.json()
}

async function fetchRepos(user) {
  const repos = []
  for (let page = 1; page <= 10; page++) {
    const batch = await ghFetch(
      `https://api.github.com/users/${user}/repos?per_page=100&sort=updated&page=${page}`,
    )
    if (!batch.length) break
    repos.push(...batch)
    if (batch.length < 100) break
  }
  return repos
}

/** Legacy top-down layout — kept for the fallback (language-only) path. */
function gridLayout(index, count, w, h, gutter, headerY = 0) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)))
  const rows = Math.ceil(count / cols)
  const cellW = Math.floor((w - gutter * (cols + 1)) / cols)
  const cellH = Math.floor((h - headerY - gutter * (rows + 1)) / rows)
  const c = index % cols
  const r = Math.floor(index / cols)
  return {
    x: gutter + c * (cellW + gutter),
    y: headerY + gutter + r * (cellH + gutter),
    width: cellW,
    height: cellH,
  }
}

/**
 * Bottom-up sizing so every node is big enough for its own content:
 * - buildings are guaranteed 280×180 (fits header + description + tags + link)
 * - neighborhoods sized to hold their buildings in a grid + header
 * - districts sized to hold their neighborhoods + header
 * Returns { size: {width, height}, cells: [{x, y, width, height}] }
 */
const BUILDING_W = 280
const BUILDING_H = 190
const NEIGH_HEADER = 44
const DIST_HEADER = 72
const CITY_HEADER = 96
const NEIGH_PAD = 16
const DIST_PAD = 28
const CITY_PAD = 40
const NEIGH_GUTTER = 12
const DIST_GUTTER = 24
const CITY_GUTTER = 40

function packGrid(cellSizes, gutter, headerY, padX, colsHint) {
  // cellSizes: array of {width, height}
  const n = cellSizes.length
  const cols = colsHint ?? Math.max(1, Math.ceil(Math.sqrt(n)))
  const rows = Math.ceil(n / cols)
  // Per-column max width, per-row max height (variable sizes supported).
  const colW = Array(cols).fill(0)
  const rowH = Array(rows).fill(0)
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols
    colW[c] = Math.max(colW[c], cellSizes[i].width)
    rowH[r] = Math.max(rowH[r], cellSizes[i].height)
  }
  const cells = []
  let cursorY = headerY + gutter
  for (let r = 0; r < rows; r++) {
    let cursorX = padX + gutter
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      if (i >= n) break
      cells.push({
        x: cursorX,
        y: cursorY,
        width: cellSizes[i].width,
        height: cellSizes[i].height,
      })
      cursorX += colW[c] + gutter
    }
    cursorY += rowH[r] + gutter
  }
  const totalW = padX + gutter + colW.reduce((a, b) => a + b, 0) + gutter * cols
  const totalH = cursorY + padX
  return { size: { width: Math.ceil(totalW), height: Math.ceil(totalH) }, cells }
}

/**
 * Reorder a set of sibling entity IDs so that connected pairs end up adjacent
 * in the resulting sequence — grid layout will then place them close together
 * and edges have short, mostly-straight paths.
 *
 * Algorithm:
 *   1. Build undirected adjacency inside the sibling set.
 *   2. Extract connected components; largest first.
 *   3. Within each component, seed with the highest-degree node, then greedily
 *      append the yet-unplaced neighbour with the most edges to already-placed
 *      nodes (ties broken by original order for stability).
 *   4. Concatenate components; isolates (degree 0) come last in original order.
 *
 * `weightOf(a, b)` optionally boosts specific pairs (e.g. strong edge kinds).
 */
function orderByConnectivity(ids, edges, weightOf = () => 1) {
  const idSet = new Set(ids)
  const adj = new Map(ids.map((id) => [id, new Map()]))
  for (const e of edges) {
    if (!idSet.has(e.from) || !idSet.has(e.to) || e.from === e.to) continue
    const w = weightOf(e)
    adj.get(e.from).set(e.to, (adj.get(e.from).get(e.to) || 0) + w)
    adj.get(e.to).set(e.from, (adj.get(e.to).get(e.from) || 0) + w)
  }
  const order = new Map(ids.map((id, i) => [id, i]))
  const degree = (id) => [...adj.get(id).values()].reduce((a, b) => a + b, 0)

  const visited = new Set()
  const components = []
  for (const seed of ids) {
    if (visited.has(seed)) continue
    if (adj.get(seed).size === 0) continue     // isolates handled later
    // BFS to collect this component
    const comp = new Set([seed])
    const q = [seed]
    visited.add(seed)
    while (q.length) {
      const n = q.shift()
      for (const nb of adj.get(n).keys()) {
        if (!visited.has(nb)) { visited.add(nb); comp.add(nb); q.push(nb) }
      }
    }
    components.push(comp)
  }
  // Largest components first — better use of grid rows/columns.
  components.sort((a, b) => b.size - a.size)

  const out = []
  for (const comp of components) {
    const compIds = [...comp]
    compIds.sort((a, b) => degree(b) - degree(a) || order.get(a) - order.get(b))
    const placed = new Set()
    const seq = []
    seq.push(compIds[0]); placed.add(compIds[0])
    while (seq.length < compIds.length) {
      let best = null, bestScore = -Infinity, bestOrder = Infinity
      for (const cand of compIds) {
        if (placed.has(cand)) continue
        let score = 0
        for (const p of placed) score += adj.get(cand).get(p) || 0
        // Boost by candidate's overall degree so hubs land central.
        score = score * 100 + degree(cand)
        const o = order.get(cand)
        if (score > bestScore || (score === bestScore && o < bestOrder)) {
          bestScore = score; bestOrder = o; best = cand
        }
      }
      seq.push(best); placed.add(best)
    }
    out.push(...seq)
  }
  // Isolates in original order.
  const placedAll = new Set(out)
  for (const id of ids) if (!placedAll.has(id)) out.push(id)

  // 2-opt local search: try swapping every pair; keep swaps that reduce the sum
  // of Chebyshev grid distances between connected pairs. Converges in a few sweeps.
  const cols = Math.max(1, Math.ceil(Math.sqrt(out.length)))
  const cellOf = (idx) => ({ r: Math.floor(idx / cols), c: idx % cols })
  const totalDist = (arr) => {
    const idx = new Map(arr.map((id, i) => [id, i]))
    let sum = 0
    for (const e of edges) {
      const ai = idx.get(e.from), bi = idx.get(e.to)
      if (ai === undefined || bi === undefined) continue
      const a = cellOf(ai), b = cellOf(bi)
      sum += Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c))
    }
    return sum
  }
  let bestArr = [...out]
  let bestSum = totalDist(bestArr)
  for (let sweep = 0; sweep < 8; sweep++) {
    let improved = false
    for (let i = 0; i < bestArr.length; i++) {
      for (let j = i + 1; j < bestArr.length; j++) {
        const trial = [...bestArr]
        ;[trial[i], trial[j]] = [trial[j], trial[i]]
        const s = totalDist(trial)
        if (s < bestSum) { bestArr = trial; bestSum = s; improved = true }
      }
    }
    if (!improved) break
  }
  return bestArr
}

function buildingNotes(r) {
  return [
    `# ${r.name}`,
    r.description ? `\n${r.description}` : '',
    `\n- Repository: ${r.html_url}`,
    r.homepage ? `- Homepage: ${r.homepage}` : '',
    `- Language: ${r.language || 'n/a'}`,
    `- Stars: ${r.stargazers_count}   Forks: ${r.forks_count}`,
    `- Updated: ${r.updated_at?.slice(0, 10)}`,
    r.license?.spdx_id ? `- License: ${r.license.spdx_id}` : '',
    r.topics?.length ? `- Topics: ${r.topics.join(', ')}` : '',
  ].filter(Boolean).join('\n')
}

function buildingMetadata(r) {
  return {
    repo: r.full_name,
    url: r.html_url,
    homepage: r.homepage,
    stars: r.stargazers_count,
    forks: r.forks_count,
    openIssues: r.open_issues_count,
    language: r.language,
    license: r.license?.spdx_id,
    topics: r.topics || [],
    tags: r.topics || [],
    defaultBranch: r.default_branch,
    pushedAt: r.pushed_at,
  }
}

async function main() {
  console.error(`> Fetching repos for ${username}…`)
  const repos = await fetchRepos(username)
  const active = repos.filter((r) => !r.fork && !r.archived)
  console.error(`  found ${repos.length} (${active.length} non-fork, non-archived)`)
  console.error(`  grouping: ${groupingPath ? path.basename(groupingPath) : '(none — using language groups)'}`)

  const byName = new Map(active.map((r) => [r.name, r]))
  const repoIdByName = new Map()
  const used = new Set()

  if (grouping) {
    // ── Phase 0: connectivity-aware ordering.
    // Reorder siblings at each container level so that connected pairs land
    // adjacent in the grid → shorter, less-tangled edges.
    const rawEdges = (grouping.connections || []).map((c) => ({ from: c.from, to: c.to }))

    // Which subsystem does a repo belong to?
    const subsystemOfRepo = new Map()
    for (const p of grouping.products) {
      for (const s of p.subsystems) {
        for (const n of s.repos) subsystemOfRepo.set(n, `${p.name}::${s.name}`)
      }
    }
    // Which product?
    const productOfSubsystem = new Map()
    for (const p of grouping.products) {
      for (const s of p.subsystems) productOfSubsystem.set(`${p.name}::${s.name}`, p.name)
    }
    const productOfRepo = new Map()
    for (const [repo, sub] of subsystemOfRepo) productOfRepo.set(repo, productOfSubsystem.get(sub))

    // Edges between subsystems (both endpoints in same product but different subsystems).
    const subsystemEdges = []
    for (const e of rawEdges) {
      const a = subsystemOfRepo.get(e.from), b = subsystemOfRepo.get(e.to)
      if (a && b && a !== b && productOfSubsystem.get(a) === productOfSubsystem.get(b)) {
        subsystemEdges.push({ from: a, to: b })
      }
    }
    // Edges between products (endpoints in different products).
    const productEdges = []
    for (const e of rawEdges) {
      const a = productOfRepo.get(e.from), b = productOfRepo.get(e.to)
      if (a && b && a !== b) productEdges.push({ from: a, to: b })
    }

    // ── Phase 1: pre-compute bottom-up layout so every node has room for its content.
    // Buildings are 280x190, neighborhoods sized to hold them, districts sized to hold
    // neighborhoods, city sized to hold districts. Rendered content per level:
    //   BUILDING     — title, description (2 lines), tag chips, language chip, repo link
    //   NEIGHBORHOOD — title + N buildings in a grid
    //   DISTRICT     — title + M neighborhoods in a grid
    //   CITY         — title + K districts in a grid
    const productPlan = grouping.products.map((p) => {
      const subsystemPlan = p.subsystems.map((s) => {
        const presentRepos = s.repos.filter((n) => byName.has(n))
        const ordered = orderByConnectivity(presentRepos, rawEdges)
        const buildingCells = ordered.map(() => ({ width: BUILDING_W, height: BUILDING_H }))
        const packed = packGrid(buildingCells, NEIGH_GUTTER, NEIGH_HEADER, NEIGH_PAD)
        return { subsystem: s, presentRepos: ordered, buildingLayout: packed.cells, size: packed.size }
      })
      // Reorder subsystems within the district so connected pairs are adjacent.
      const subKeys = subsystemPlan.map((sp) => `${p.name}::${sp.subsystem.name}`)
      const orderedSubKeys = orderByConnectivity(subKeys, subsystemEdges)
      const orderedSubPlan = orderedSubKeys.map((k) =>
        subsystemPlan.find((sp) => `${p.name}::${sp.subsystem.name}` === k)
      )
      const subCells = orderedSubPlan.map((sp) => sp.size)
      const packed = packGrid(subCells, DIST_GUTTER, DIST_HEADER, DIST_PAD)
      return { product: p, subsystemPlan: orderedSubPlan, subLayout: packed.cells, size: packed.size }
    })

    // Reorder products (districts) within the city by cross-product connectivity.
    const productKeys = productPlan.map((pp) => pp.product.name)
    const orderedProductKeys = orderByConnectivity(productKeys, productEdges)
    const orderedProductPlan = orderedProductKeys.map((k) =>
      productPlan.find((pp) => pp.product.name === k)
    )
    productPlan.length = 0
    productPlan.push(...orderedProductPlan)

    // Uncategorized district (if any leftovers), planned as language sub-neighborhoods.
    const leftovers = active.filter((r) => !grouping.products.some((p) =>
      p.subsystems.some((s) => s.repos.includes(r.name))))
    let uncatPlan = null
    if (leftovers.length) {
      const byLang = new Map()
      for (const r of leftovers) {
        const lang = r.language || '(unknown)'
        if (!byLang.has(lang)) byLang.set(lang, [])
        byLang.get(lang).push(r)
      }
      const langs = [...byLang.entries()].sort((a, b) => b[1].length - a[1].length)
      const subsystemPlan = langs.map(([lang, langRepos]) => {
        const buildingCells = langRepos.map(() => ({ width: BUILDING_W, height: BUILDING_H }))
        const packed = packGrid(buildingCells, NEIGH_GUTTER, NEIGH_HEADER, NEIGH_PAD)
        return {
          subsystem: { name: lang, color: LANG_COLORS[lang] || LANG_COLORS['(unknown)'] },
          presentRepos: langRepos.map((r) => r.name),
          langRepos,
          buildingLayout: packed.cells,
          size: packed.size,
        }
      })
      const subCells = subsystemPlan.map((sp) => sp.size)
      const packed = packGrid(subCells, DIST_GUTTER, DIST_HEADER, DIST_PAD)
      uncatPlan = { subsystemPlan, subLayout: packed.cells, size: packed.size }
    }

    // Pack districts into the city.
    const districtCells = productPlan.map((pp) => pp.size)
    if (uncatPlan) districtCells.push(uncatPlan.size)
    const cityPack = packGrid(districtCells, CITY_GUTTER, CITY_HEADER, CITY_PAD)

    // ── Phase 2: create the components with computed sizes.
    const city = await apiCall('/api/components', {
      method: 'POST',
      body: JSON.stringify({
        name: cityName,
        type: 'CITY',
        level: 0,
        x: 0, y: 0, width: cityPack.size.width, height: cityPack.size.height,
        color: '#0f172a',
        description: grouping?.cityDescription || `Imported from https://github.com/${username}`,
        notes: `# ${cityName}\n\nSeeded from GitHub. ${active.length} active repositories.\n\n- Total repos scanned: ${repos.length}\n- Grouping: ${groupingPath ? path.basename(groupingPath) : 'by language'}\n`,
        metadata: {
          source: `github:${username}`,
          importedAt: new Date().toISOString(),
          totalRepos: repos.length,
          grouping: groupingPath ? path.basename(groupingPath) : null,
        },
      }),
    })
    console.error(`> Created city "${city.name}" ${cityPack.size.width}×${cityPack.size.height} (${city.id})`)

    for (let di = 0; di < productPlan.length; di++) {
      const pp = productPlan[di]
      const p = pp.product
      const dCell = cityPack.cells[di]
      const district = await apiCall('/api/components', {
        method: 'POST',
        body: JSON.stringify({
          name: p.name,
          parentId: city.id,
          type: 'DISTRICT',
          level: 1,
          x: dCell.x, y: dCell.y, width: dCell.width, height: dCell.height,
          color: p.color || '#334155',
          description: p.description,
          metadata: { product: p.name },
        }),
      })
      console.error(`  district: ${p.name} ${dCell.width}×${dCell.height}`)

      for (let si = 0; si < pp.subsystemPlan.length; si++) {
        const sp = pp.subsystemPlan[si]
        const s = sp.subsystem
        const sCell = pp.subLayout[si]
        const neighborhood = await apiCall('/api/components', {
          method: 'POST',
          body: JSON.stringify({
            name: s.name,
            parentId: district.id,
            type: 'NEIGHBORHOOD',
            level: 2,
            x: sCell.x, y: sCell.y, width: sCell.width, height: sCell.height,
            color: s.color || p.color,
            description: `${sp.presentRepos.length} repositories`,
            metadata: { subsystem: s.name, product: p.name },
          }),
        })
        console.error(`    · ${s.name} (${sp.presentRepos.length}) ${sCell.width}×${sCell.height}`)

        for (let bi = 0; bi < sp.presentRepos.length; bi++) {
          const r = byName.get(sp.presentRepos[bi])
          used.add(r.name)
          const bCell = sp.buildingLayout[bi]
          const b = await apiCall('/api/components', {
            method: 'POST',
            body: JSON.stringify({
              name: r.name,
              parentId: neighborhood.id,
              type: 'BUILDING',
              level: 3,
              x: bCell.x, y: bCell.y,
              width: bCell.width, height: bCell.height,
              color: s.color || p.color,
              description: (r.description || '').slice(0, 240),
              notes: buildingNotes(r),
              metadata: buildingMetadata(r),
            }),
          })
          repoIdByName.set(r.name, b.id)
        }
      }
    }

    // Uncategorized
    if (uncatPlan) {
      const dCell = cityPack.cells[productPlan.length]
      const district = await apiCall('/api/components', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Uncategorized',
          parentId: city.id,
          type: 'DISTRICT',
          level: 1,
          x: dCell.x, y: dCell.y, width: dCell.width, height: dCell.height,
          color: '#374151',
          description: `${leftovers.length} repositories not yet placed in a product`,
        }),
      })
      for (let li = 0; li < uncatPlan.subsystemPlan.length; li++) {
        const sp = uncatPlan.subsystemPlan[li]
        const sCell = uncatPlan.subLayout[li]
        const neighborhood = await apiCall('/api/components', {
          method: 'POST',
          body: JSON.stringify({
            name: sp.subsystem.name,
            parentId: district.id,
            type: 'NEIGHBORHOOD',
            level: 2,
            x: sCell.x, y: sCell.y, width: sCell.width, height: sCell.height,
            color: sp.subsystem.color,
            description: `${sp.langRepos.length} repos`,
          }),
        })
        for (let bi = 0; bi < sp.langRepos.length; bi++) {
          const r = sp.langRepos[bi]
          const bCell = sp.buildingLayout[bi]
          const b = await apiCall('/api/components', {
            method: 'POST',
            body: JSON.stringify({
              name: r.name,
              parentId: neighborhood.id,
              type: 'BUILDING',
              level: 3,
              x: bCell.x, y: bCell.y,
              width: bCell.width, height: bCell.height,
              color: sp.subsystem.color,
              description: (r.description || '').slice(0, 240),
              notes: buildingNotes(r),
              metadata: buildingMetadata(r),
            }),
          })
          repoIdByName.set(r.name, b.id)
        }
      }
      console.error(`  district: Uncategorized (${leftovers.length}) ${dCell.width}×${dCell.height}`)
    }

    // Curated dependency edges
    let edgesMade = 0, edgesSkipped = 0
    for (const c of grouping.connections || []) {
      const sourceId = repoIdByName.get(c.from)
      const targetId = repoIdByName.get(c.to)
      if (!sourceId || !targetId) { edgesSkipped++; continue }
      await apiCall('/api/connections', {
        method: 'POST',
        body: JSON.stringify({ sourceId, targetId, kind: c.kind || 'uses', label: c.label }),
      })
      edgesMade++
    }
    console.error(`  connections: ${edgesMade} added, ${edgesSkipped} skipped (repo absent)`)
    console.error(`✓ Done. Open the UI to see "${city.name}".`)
    return
  }

  // ── Fallback: group by primary language, still using bottom-up sizing.
  const byLang = new Map()
  for (const r of active) {
    const lang = r.language || '(unknown)'
    if (!byLang.has(lang)) byLang.set(lang, [])
    byLang.get(lang).push(r)
  }
  const langs = [...byLang.entries()].sort((a, b) => b[1].length - a[1].length)
  const langPlan = langs.map(([lang, langRepos]) => {
    const cells = langRepos.map(() => ({ width: BUILDING_W, height: BUILDING_H }))
    const packed = packGrid(cells, DIST_GUTTER, DIST_HEADER, DIST_PAD)
    return { lang, langRepos, buildingLayout: packed.cells, size: packed.size }
  })
  const cityPack = packGrid(langPlan.map((lp) => lp.size), CITY_GUTTER, CITY_HEADER, CITY_PAD)

  const city = await apiCall('/api/components', {
    method: 'POST',
    body: JSON.stringify({
      name: cityName, type: 'CITY', level: 0,
      x: 0, y: 0, width: cityPack.size.width, height: cityPack.size.height,
      color: '#0f172a',
      description: `Imported from https://github.com/${username}`,
    }),
  })
  for (let li = 0; li < langPlan.length; li++) {
    const lp = langPlan[li]
    const dCell = cityPack.cells[li]
    const district = await apiCall('/api/components', {
      method: 'POST',
      body: JSON.stringify({
        name: lp.lang, parentId: city.id, type: 'DISTRICT', level: 1,
        x: dCell.x, y: dCell.y, width: dCell.width, height: dCell.height,
        color: LANG_COLORS[lp.lang] || LANG_COLORS['(unknown)'],
        description: `${lp.langRepos.length} ${lp.lang} repositories`,
      }),
    })
    console.error(`  district: ${lp.lang} — ${lp.langRepos.length} repos`)
    for (let bi = 0; bi < lp.langRepos.length; bi++) {
      const r = lp.langRepos[bi]
      const bCell = lp.buildingLayout[bi]
      await apiCall('/api/components', {
        method: 'POST',
        body: JSON.stringify({
          name: r.name, parentId: district.id, type: 'BUILDING', level: 3,
          x: bCell.x, y: bCell.y, width: bCell.width, height: bCell.height,
          color: LANG_COLORS[lp.lang] || LANG_COLORS['(unknown)'],
          description: (r.description || '').slice(0, 240),
          notes: buildingNotes(r),
          metadata: buildingMetadata(r),
        }),
      })
    }
  }
  console.error(`✓ Done. Open the UI to see "${city.name}".`)
}

main().catch((err) => {
  console.error('✗', err.message)
  process.exit(1)
})
