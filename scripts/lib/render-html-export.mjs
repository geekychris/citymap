/**
 * Render an entire city map as a single self-contained HTML file.
 *
 * No CDNs, no external assets — everything (CSS, JS, data) is inlined so the
 * result is a portable artifact you can email, host on S3, or open with `file://`.
 *
 * Interactions supported: pan (drag), zoom (wheel / +/-), click-to-select,
 * double-click-to-focus (drills into a subtree), Esc to zoom out, keyword
 * search that dims non-matching nodes, and a details side panel showing name,
 * type, description, notes, tags, metadata + any repo link.
 */

export function renderHtmlExport({ components, connections, cityName }) {
  const payload = { components, connections }
  const dataJson = JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

  const cityTitle = escapeHtml(cityName || 'CityMap Export')
  const componentCount = components.length
  const connectionCount = connections.length
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'

  return template({ dataJson, cityTitle, componentCount, connectionCount, generatedAt })
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c])
}

function template({ dataJson, cityTitle, componentCount, connectionCount, generatedAt }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${cityTitle} — CityMap export</title>
  <style>${CSS}</style>
</head>
<body>
  <header id="topbar">
    <div class="brand">
      <span class="brand-mark"></span>
      <span class="brand-name">${cityTitle}</span>
      <span class="brand-sub">CityMap export · ${componentCount} components · ${connectionCount} connections · ${generatedAt}</span>
    </div>
    <div class="controls">
      <input id="search" type="search" placeholder="Search components…" autocomplete="off" />
      <button id="reset" class="btn" title="Fit to whole city">Fit</button>
      <button id="up" class="btn" title="Zoom out one level (Esc)">↑ Up</button>
    </div>
  </header>
  <main id="stage">
    <div id="viewport">
      <div id="world">
        <svg id="edges" xmlns="http://www.w3.org/2000/svg"></svg>
        <div id="nodes"></div>
      </div>
      <div id="crumb"></div>
      <div id="hint">drag = pan · wheel = zoom · click = select · double-click = focus</div>
    </div>
    <aside id="panel">
      <div id="panel-empty">Click any component for details.</div>
      <div id="panel-content" hidden></div>
    </aside>
  </main>
  <script>
    const DATA = ${dataJson};
    ${JS}
  </script>
</body>
</html>
`
}

const CSS = `
:root {
  color-scheme: dark;
  --panel: #0b1220;
  --panel2: #111a2e;
  --card: #151f36;
  --line: #1e2a44;
  --ink: #e2e8f0;
  --subink: #94a3b8;
  --accent: #38bdf8;
  --accent2: #a78bfa;
}
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  background: radial-gradient(at 20% 0%, #0b1220 0%, #05080f 65%);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, "Inter", system-ui, "Segoe UI",
               Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
#topbar {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 16px;
  height: 48px; min-height: 48px;
  border-bottom: 1px solid var(--line);
  background: rgba(11, 18, 32, 0.85);
  backdrop-filter: blur(6px);
  z-index: 10;
}
.brand { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
.brand-mark {
  width: 14px; height: 14px; border-radius: 4px;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.4);
}
.brand-name { font-weight: 700; font-size: 15px; }
.brand-sub  { font-weight: 400; font-size: 12px; color: var(--subink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.controls { display: flex; align-items: center; gap: 8px; }
.controls input#search {
  background: var(--panel2);
  border: 1px solid var(--line);
  color: var(--ink);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 13px;
  width: 220px;
}
.controls input#search:focus { outline: none; border-color: var(--accent); }
.btn {
  background: rgba(148, 163, 184, 0.12);
  color: var(--ink);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
}
.btn:hover { background: rgba(148, 163, 184, 0.22); }

#stage { flex: 1; display: flex; overflow: hidden; }
#viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
  cursor: grab;
  background:
    radial-gradient(circle at 30% 40%, rgba(56, 189, 248, 0.05), transparent 60%),
    radial-gradient(circle at 70% 60%, rgba(167, 139, 250, 0.05), transparent 60%);
}
#viewport.dragging { cursor: grabbing; }
#world {
  position: absolute;
  top: 0; left: 0;
  transform-origin: 0 0;
  will-change: transform;
}
#edges {
  position: absolute; top: 0; left: 0;
  overflow: visible;
  pointer-events: none;
}
#nodes { position: relative; }
#crumb {
  position: absolute; top: 12px; left: 12px;
  padding: 6px 10px;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid var(--line);
  border-radius: 8px;
  font-size: 12px;
  color: var(--subink);
  display: none;
}
#crumb .up {
  color: var(--accent);
  cursor: pointer;
  margin-right: 8px;
}
#crumb .up:hover { text-decoration: underline; }
#hint {
  position: absolute; bottom: 12px; left: 12px;
  padding: 6px 10px;
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid var(--line);
  border-radius: 8px;
  font-size: 11px;
  color: var(--subink);
  pointer-events: none;
}

.node {
  position: absolute;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  color: rgba(255, 255, 255, 0.94);
  transition: box-shadow 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
  cursor: pointer;
}
.node.dim { opacity: 0.25; }
.node.selected {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  box-shadow: 0 6px 32px rgba(56, 189, 248, 0.35);
}
.node .head {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
}
.node .head .title {
  flex: 1 1 0%; min-width: 0;
  font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.10);
  color: rgba(255, 255, 255, 0.85);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 10px;
  flex-shrink: 0;
}
.node .body { padding: 6px 10px; overflow: hidden; }
.node .desc {
  font-size: 12px; line-height: 1.4;
  color: rgba(226, 232, 240, 0.88);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.node .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.chip {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px;
  background: rgba(148, 163, 184, 0.15);
  color: #cbd5e1;
  padding: 2px 7px;
  border-radius: 999px;
}
.node .repo-link {
  display: inline-block; margin-top: 4px;
  color: var(--accent);
  font-size: 11px;
  text-decoration: underline;
}
.node .repo-link:hover { color: #7dd3fc; }
/* per-level typography — mirrors ComponentNode.HEADER_STYLE from the app */
.level-0 .head { padding: 16px 22px; }
.level-0 .head .title { font-size: 48px; font-weight: 700; }
.level-0 .head .badge { font-size: 14px; padding: 3px 10px; }
.level-1 .head { padding: 12px 18px; }
.level-1 .head .title { font-size: 30px; font-weight: 700; }
.level-1 .head .badge { font-size: 12px; padding: 3px 8px; }
.level-2 .head { padding: 8px 14px; }
.level-2 .head .title { font-size: 20px; font-weight: 600; }
.level-2 .head .badge { font-size: 10px; padding: 2px 6px; }
.level-3 .head { padding: 6px 10px; }
.level-3 .head .title { font-size: 13px; font-weight: 600; }
.level-3 .head .badge { display: none; }
.level-4 .head { padding: 5px 8px; }
.level-4 .head .title { font-size: 12px; font-weight: 600; }
.level-4 .head .badge { display: none; }

#panel {
  width: 380px; min-width: 380px;
  border-left: 1px solid var(--line);
  background: rgba(11, 18, 32, 0.85);
  padding: 12px 16px;
  overflow-y: auto;
}
#panel-empty { color: var(--subink); font-size: 13px; padding-top: 20px; text-align: center; }
#panel-content h2 {
  font-size: 15px; margin: 0 0 6px 0;
  display: flex; align-items: center; gap: 8px;
}
#panel-content .path { color: var(--subink); font-size: 11px; margin-bottom: 8px; }
#panel-content .row { margin: 10px 0; }
#panel-content .label {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--subink); margin-bottom: 4px;
}
#panel-content .value { font-size: 13px; color: var(--ink); line-height: 1.4; }
#panel-content pre {
  background: var(--panel2); border: 1px solid var(--line);
  padding: 8px; border-radius: 6px; overflow: auto; font-size: 11px;
  max-height: 280px;
}
#panel-content a { color: var(--accent); }
#panel-content .notes {
  background: var(--panel2); border: 1px solid var(--line);
  padding: 8px 10px; border-radius: 6px; font-size: 12px;
  white-space: pre-wrap; word-break: break-word;
  max-height: 200px; overflow-y: auto;
}

/* SVG edges */
#edges line { pointer-events: stroke; cursor: pointer; }

/* Scrollbar */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.25);
  border-radius: 10px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
`

// The runtime — vanilla JS, no dependencies.
const JS = String.raw`
(() => {
  const $ = (id) => document.getElementById(id);
  const viewport = $('viewport');
  const world = $('world');
  const nodesEl = $('nodes');
  const edgesEl = $('edges');
  const panel = $('panel-content');
  const panelEmpty = $('panel-empty');
  const search = $('search');
  const crumb = $('crumb');
  const btnReset = $('reset');
  const btnUp = $('up');

  const byId = new Map(DATA.components.map(c => [c.id, c]));
  const childrenOf = new Map();
  for (const c of DATA.components) {
    if (!childrenOf.has(c.parentId || null)) childrenOf.set(c.parentId || null, []);
    childrenOf.get(c.parentId || null).push(c);
  }

  // Compute absolute (world) position of every node once.
  const abs = new Map();
  function computeAbs(root, parentX, parentY) {
    abs.set(root.id, { x: parentX + root.x, y: parentY + root.y });
    for (const child of (childrenOf.get(root.id) || [])) computeAbs(child, parentX + root.x, parentY + root.y);
  }
  for (const r of (childrenOf.get(null) || [])) computeAbs(r, 0, 0);

  const state = {
    scale: 0.5,
    tx: 100,
    ty: 100,
    focusRootId: null,
    selectedId: null,
    query: '',
  };

  function applyTransform() {
    world.style.transform = 'translate(' + state.tx + 'px, ' + state.ty + 'px) scale(' + state.scale + ')';
  }

  function ancestors(id) {
    const chain = [];
    let cur = byId.get(id);
    while (cur) { chain.unshift(cur); cur = cur.parentId ? byId.get(cur.parentId) : null; }
    return chain;
  }

  function visibleIds() {
    if (!state.focusRootId) return new Set(DATA.components.map(c => c.id));
    const s = new Set(); const q = [state.focusRootId];
    while (q.length) { const id = q.shift(); s.add(id); for (const ch of (childrenOf.get(id) || [])) q.push(ch.id); }
    return s;
  }

  function pickTextColor(bg) {
    if (!bg) return '#fff';
    const hex = bg.replace('#', '');
    const b = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
    const r = parseInt(b.slice(0,2), 16), g = parseInt(b.slice(2,4), 16), bl = parseInt(b.slice(4,6), 16);
    const luma = 0.2126*r + 0.7152*g + 0.0722*bl;
    return luma > 160 ? '#0b1220' : '#fff';
  }

  function hexA(hex, a) {
    if (!hex) return 'rgba(51,65,85,' + a + ')';
    const h = hex.replace('#', '');
    const b = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const r = parseInt(b.slice(0,2), 16), g = parseInt(b.slice(2,4), 16), bl = parseInt(b.slice(4,6), 16);
    return 'rgba(' + r + ',' + g + ',' + bl + ',' + a + ')';
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function render() {
    nodesEl.innerHTML = '';
    edgesEl.innerHTML = '';
    const visible = visibleIds();
    const sorted = DATA.components
      .filter(c => visible.has(c.id))
      .sort((a, b) => a.level - b.level);

    // Bounding box of visible world for SVG sizing
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of sorted) {
      const p = abs.get(c.id);
      const px = state.focusRootId === c.id ? 0 : p.x;
      const py = state.focusRootId === c.id ? 0 : p.y;
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px + c.width > maxX) maxX = px + c.width;
      if (py + c.height > maxY) maxY = py + c.height;
    }
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 100; maxY = 100; }
    edgesEl.style.width  = (maxX - minX + 200) + 'px';
    edgesEl.style.height = (maxY - minY + 200) + 'px';
    edgesEl.setAttribute('viewBox', minX + ' ' + minY + ' ' + (maxX - minX + 200) + ' ' + (maxY - minY + 200));
    edgesEl.style.left = '0px'; edgesEl.style.top = '0px';

    // Recompute abs positions when we focus on a subtree, so the focus root is at origin.
    const focusOffset = state.focusRootId
      ? (() => { const a = abs.get(state.focusRootId); return { x: a.x, y: a.y }; })()
      : { x: 0, y: 0 };

    const positions = new Map();
    for (const c of sorted) {
      const a = abs.get(c.id);
      positions.set(c.id, { x: a.x - focusOffset.x, y: a.y - focusOffset.y });
    }

    const q = state.query.trim().toLowerCase();
    const matches = (c) => !q ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q) ||
      JSON.stringify(c.metadata || {}).toLowerCase().includes(q);

    // A node is highlighted if it (or any descendant) matches.
    const highlight = new Set();
    if (q) {
      for (const c of DATA.components) {
        if (matches(c)) {
          highlight.add(c.id);
          let p = c.parentId;
          while (p) { highlight.add(p); const pc = byId.get(p); p = pc && pc.parentId; }
        }
      }
    }

    for (const c of sorted) {
      const p = positions.get(c.id);
      const el = document.createElement('div');
      el.dataset.id = c.id;
      el.className = 'node level-' + c.level +
        (state.selectedId === c.id ? ' selected' : '') +
        (q && !highlight.has(c.id) ? ' dim' : '');
      el.style.left = p.x + 'px';
      el.style.top  = p.y + 'px';
      el.style.width  = c.width + 'px';
      el.style.height = c.height + 'px';
      el.style.background = 'linear-gradient(180deg, ' + hexA(c.color, 0.25) + ', ' + hexA(c.color, 0.55) + ')';
      // Deeper levels paint on top so smaller inner nodes are hit-testable and
      // visually cover their parents. (In the live React Flow app, nodes are
      // actually nested in the DOM so this comes for free.)
      el.style.zIndex = String(c.level + 1);

      const hasChildren = childrenOf.has(c.id) && childrenOf.get(c.id).length > 0;
      const tags = (c.metadata && Array.isArray(c.metadata.tags)) ? c.metadata.tags.slice(0, 6) : [];
      const stars = c.metadata && typeof c.metadata.stars === 'number' ? c.metadata.stars : null;
      const language = c.metadata && c.metadata.language;
      const url = c.metadata && c.metadata.url;

      const bodyBits = [];
      const showBody = !hasChildren && c.width >= 200 && c.height >= 100;
      const showTags = !hasChildren && c.width >= 240 && c.height >= 140 && tags.length;
      const showLang = !hasChildren && c.width >= 260 && c.height >= 170 && language;
      const showLink = !hasChildren && c.width >= 220 && c.height >= 80 && url;

      if (showBody && c.description) {
        bodyBits.push('<div class="desc">' + esc(c.description) + '</div>');
      }
      if (showTags) {
        bodyBits.push('<div class="chips">' + tags.map(t => '<span class="chip">' + esc(t) + '</span>').join('') + '</div>');
      }
      if (showLang) {
        bodyBits.push('<div class="chips"><span class="chip">' + esc(language) + '</span></div>');
      }
      if (showLink) {
        const short = String(url).replace(/^https?:\/\/(www\.)?/, '');
        bodyBits.push('<a class="repo-link" href="' + esc(url) + '" target="_blank" rel="noreferrer" onclick="event.stopPropagation();">' + esc(short) + '</a>');
      }

      const starsBadge = (stars != null && c.level >= 3 && c.width >= 260)
        ? '<span class="badge">★ ' + stars + '</span>' : '';

      el.innerHTML =
        '<div class="head">' +
          '<span class="title">' + esc(c.name) + '</span>' +
          starsBadge +
          (c.type ? '<span class="badge">' + esc(c.type) + '</span>' : '') +
        '</div>' +
        (bodyBits.length ? '<div class="body">' + bodyBits.join('') + '</div>' : '');

      el.addEventListener('click', (e) => { e.stopPropagation(); selectNode(c.id); });
      el.addEventListener('dblclick', (e) => { e.stopPropagation(); focusOn(c.id); });
      nodesEl.appendChild(el);
    }

    // Edges — only within the visible set
    for (const conn of DATA.connections) {
      if (!visible.has(conn.sourceId) || !visible.has(conn.targetId)) continue;
      const s = byId.get(conn.sourceId), t = byId.get(conn.targetId);
      if (!s || !t) continue;
      const sp = positions.get(s.id), tp = positions.get(t.id);
      if (!sp || !tp) continue;
      const x1 = sp.x + s.width;
      const y1 = sp.y + s.height / 2;
      const x2 = tp.x;
      const y2 = tp.y + t.height / 2;
      // Bezier curve
      const dx = Math.abs(x2 - x1);
      const midx1 = x1 + dx * 0.4;
      const midx2 = x2 - dx * 0.4;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + midx1 + ' ' + y1 + ', ' + midx2 + ' ' + y2 + ', ' + x2 + ' ' + y2);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', conn.kind === 'depends_on' ? '#a78bfa' : '#64748b');
      path.setAttribute('stroke-width', '1.5');
      if (conn.kind === 'depends_on') path.setAttribute('stroke-dasharray', '4 4');
      path.setAttribute('opacity', '0.65');
      edgesEl.appendChild(path);

      if (conn.label) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', ((x1 + x2) / 2).toString());
        text.setAttribute('y', ((y1 + y2) / 2 - 4).toString());
        text.setAttribute('font-size', '10');
        text.setAttribute('fill', '#94a3b8');
        text.setAttribute('text-anchor', 'middle');
        text.textContent = conn.label;
        edgesEl.appendChild(text);
      }
    }

    updateCrumb();
  }

  function updateCrumb() {
    if (!state.focusRootId) { crumb.style.display = 'none'; return; }
    const chain = ancestors(state.focusRootId);
    crumb.style.display = 'block';
    crumb.innerHTML = '<span class="up" data-parent="' + (chain[chain.length - 2]?.id ?? '') + '">↑ Up</span> Viewing: ' +
      chain.map(c => '<span>' + esc(c.name) + '</span>').join(' <span style="color:#475569">›</span> ');
    crumb.querySelector('.up').onclick = () => focusOn(chain[chain.length - 2]?.id ?? null);
  }

  function selectNode(id) {
    state.selectedId = id;
    const c = byId.get(id);
    if (!c) return;
    panelEmpty.hidden = true;
    panel.hidden = false;

    const path = ancestors(id).map(a => esc(a.name)).join(' › ');
    const tags = (c.metadata && Array.isArray(c.metadata.tags)) ? c.metadata.tags : [];
    const url = c.metadata && c.metadata.url;
    const lang = c.metadata && c.metadata.language;
    const stars = c.metadata && c.metadata.stars;

    let html = '<h2>' +
      '<span style="width:12px;height:12px;border-radius:3px;background:' + esc(c.color || '#334155') + ';display:inline-block"></span>' +
      esc(c.name) + '<span class="badge">' + esc(c.type || ('L' + c.level)) + '</span></h2>' +
      '<div class="path">' + path + '</div>';

    if (c.description) html += '<div class="row"><div class="label">Description</div><div class="value">' + esc(c.description) + '</div></div>';
    if (c.notes)       html += '<div class="row"><div class="label">Notes</div><div class="notes">' + esc(c.notes) + '</div></div>';
    if (tags.length)   html += '<div class="row"><div class="label">Tags</div><div class="chips">' + tags.map(t => '<span class="chip">' + esc(t) + '</span>').join('') + '</div></div>';
    if (lang || stars != null || url) {
      html += '<div class="row">';
      if (lang)         html += '<div class="label">Language</div><div class="value">' + esc(lang) + '</div>';
      if (stars != null) html += '<div class="label" style="margin-top:6px">Stars</div><div class="value">★ ' + stars + '</div>';
      if (url)          html += '<div class="label" style="margin-top:6px">Repository</div><div class="value"><a href="' + esc(url) + '" target="_blank" rel="noreferrer">' + esc(url) + '</a></div>';
      html += '</div>';
    }
    html += '<div class="row"><div class="label">Metadata</div><pre>' + esc(JSON.stringify(c.metadata || {}, null, 2)) + '</pre></div>';

    panel.innerHTML = html;
    // Update the .selected class in place — do NOT re-render the whole DOM here,
    // otherwise the click target vanishes and dblclick can never fire.
    nodesEl.querySelectorAll('.node.selected').forEach((n) => n.classList.remove('selected'));
    const sel = nodesEl.querySelector('.node[data-id="' + id + '"]');
    if (sel) sel.classList.add('selected');
  }

  function focusOn(id) {
    state.focusRootId = id;
    state.selectedId = id;
    fitToVisible();
    render();
    if (id) selectNode(id); else { panel.hidden = true; panelEmpty.hidden = false; }
  }

  function fitToVisible() {
    const visible = visibleIds();
    if (!visible.size) return;
    const focusOffset = state.focusRootId
      ? abs.get(state.focusRootId)
      : { x: 0, y: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of visible) {
      const c = byId.get(id);
      const a = abs.get(id);
      const x = a.x - focusOffset.x, y = a.y - focusOffset.y;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + c.width > maxX) maxX = x + c.width;
      if (y + c.height > maxY) maxY = y + c.height;
    }
    const w = maxX - minX, h = maxY - minY;
    const vw = viewport.clientWidth, vh = viewport.clientHeight;
    const pad = 40;
    const s = Math.min((vw - pad * 2) / w, (vh - pad * 2) / h, 2.0);
    state.scale = s;
    state.tx = pad - minX * s + (vw - pad * 2 - w * s) / 2;
    state.ty = pad - minY * s + (vh - pad * 2 - h * s) / 2;
    applyTransform();
  }

  // Pan
  let dragging = false, dragStart = null;
  viewport.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    dragStart = { x: e.clientX - state.tx, y: e.clientY - state.ty };
    viewport.classList.add('dragging');
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    state.tx = e.clientX - dragStart.x;
    state.ty = e.clientY - dragStart.y;
    applyTransform();
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    viewport.classList.remove('dragging');
  });

  // Zoom
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const newScale = Math.max(0.03, Math.min(5, state.scale * factor));
    const k = newScale / state.scale;
    state.tx = cx - (cx - state.tx) * k;
    state.ty = cy - (cy - state.ty) * k;
    state.scale = newScale;
    applyTransform();
  }, { passive: false });

  // Deselect on background click
  viewport.addEventListener('click', (e) => {
    if (e.target === viewport || e.target === world || e.target === nodesEl) {
      state.selectedId = null;
      panel.hidden = true;
      panelEmpty.hidden = false;
      render();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.focusRootId) {
        const parent = byId.get(state.focusRootId).parentId;
        focusOn(parent || null);
      } else if (state.selectedId) {
        state.selectedId = null;
        panel.hidden = true;
        panelEmpty.hidden = false;
        render();
      }
    }
  });

  search.addEventListener('input', () => { state.query = search.value; render(); });
  btnReset.onclick = () => { state.focusRootId = null; state.selectedId = null; fitToVisible(); render(); panel.hidden = true; panelEmpty.hidden = false; };
  btnUp.onclick = () => {
    if (!state.focusRootId) return;
    const parent = byId.get(state.focusRootId).parentId;
    focusOn(parent || null);
  };

  // Initial render
  fitToVisible();
  render();
})();
`
