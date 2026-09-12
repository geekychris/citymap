import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { Building2, Download, FileCode, GitBranch, Plus, Printer, RefreshCw } from 'lucide-react'
import { useUI, type ViewMode } from '../store'

export function TopBar() {
  const qc = useQueryClient()
  const focusOn = useUI((s) => s.focusOn)
  const viewMode = useUI((s) => s.viewMode)
  const setViewMode = useUI((s) => s.setViewMode)
  const showEdges = useUI((s) => s.showEdges)
  const setShowEdges = useUI((s) => s.setShowEdges)
  const [tilePages, setTilePages] = useState<string>('fit')

  const createCity = useMutation({
    mutationFn: () =>
      api.createComponent({
        name: 'New City',
        type: 'CITY',
        level: 0,
        x: 0,
        y: 0,
        width: 1600,
        height: 900,
      }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['components'] })
      focusOn(c.id)
    },
  })

  const doExport = async () => {
    const data = await api.exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `citymap-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const doExportHtml = () => {
    window.location.href = `/api/export/html?download=true&mode=${viewMode}`
  }

  // Tiled printing lives in the self-contained HTML export — its runtime knows
  // how to slice the world into letter-sized sheets. For "Fit" (single sheet)
  // we just print in-app since @media print already handles chrome hiding.
  const doPrint = () => {
    if (tilePages === 'fit') {
      window.print()
      return
    }
    const params = new URLSearchParams({
      mode: viewMode,
      tile: tilePages,
      edges: showEdges ? 'on' : 'off',
      print: '1',
    })
    window.open(`/api/export/html?${params.toString()}`, '_blank', 'noopener')
  }

  return (
    <header className="h-12 flex items-center gap-3 px-4 border-b border-line bg-panel/80 backdrop-blur no-print">
      <div className="flex items-center gap-2 font-semibold">
        <Building2 size={18} className="text-accent" />
        <span>CityMap</span>
        <span className="text-subink text-xs font-normal">TOGAF component explorer</span>
      </div>
      <div className="flex-1" />
      <ModeToggle value={viewMode} onChange={setViewMode} />
      <button
        className={`btn ${showEdges ? '' : 'opacity-60'}`}
        onClick={() => setShowEdges(!showEdges)}
        title={showEdges ? 'Hide connectors between components' : 'Show connectors between components'}
        aria-pressed={showEdges}
      >
        <GitBranch size={14} /> {showEdges ? 'Edges: on' : 'Edges: off'}
      </button>
      <select
        value={tilePages}
        onChange={(e) => setTilePages(e.target.value)}
        className="bg-panel border border-line text-ink rounded-lg px-2 py-1 text-xs"
        title="Split the map across N letter-sized sheets you can tape together. Fit prints a single sheet."
      >
        <option value="fit">Pages: fit</option>
        <option value="outline-tree">Pages: outline — tree (sidebar)</option>
        <option value="outline-compact">Pages: outline — compact</option>
        <option value="outline">Pages: outline — regular</option>
        <option value="outline-spacious">Pages: outline — spacious</option>
        <option value="l1-per-page">Pages: one L1 per page</option>
        <option value="l2-per-page">Pages: one L2 per page</option>
        <option value="1">Pages: 1 wide</option>
        <option value="2">Pages: 2 wide</option>
        <option value="3">Pages: 3 wide</option>
        <option value="4">Pages: 4 wide</option>
        <option value="6">Pages: 6 wide</option>
        <option value="8">Pages: 8 wide</option>
      </select>
      <button
        className="btn"
        onClick={doPrint}
        title={
          tilePages === 'fit'
            ? 'Print — hides chrome and prints the canvas as a single sheet'
            : tilePages === 'outline'
            ? 'Outline print — opens the HTML export in a new tab as a hierarchical text document, then use Cmd/Ctrl+P there'
            : `Tile print — opens the HTML export in a new tab with ${tilePages} sheets wide, then use Cmd/Ctrl+P there`
        }
      >
        <Printer size={14} /> Print
      </button>
      <button className="btn" onClick={() => qc.invalidateQueries({ queryKey: ['components'] })}>
        <RefreshCw size={14} /> Refresh
      </button>
      <button className="btn" onClick={doExport} title="Portable JSON — importable back into any CityMap instance">
        <Download size={14} /> Export JSON
      </button>
      <button className="btn" onClick={doExportHtml} title="Self-contained HTML — open anywhere, no server needed">
        <FileCode size={14} /> Export HTML
      </button>
      <button className="btn btn-primary" onClick={() => createCity.mutate()}>
        <Plus size={14} /> New City
      </button>
    </header>
  )
}

function ModeToggle({ value, onChange }: { value: ViewMode; onChange: (m: ViewMode) => void }) {
  const modes: { key: ViewMode; label: string; title: string }[] = [
    { key: 'city', label: 'City', title: 'Full-color city map' },
    { key: 'blueprint', label: 'Blueprint', title: 'Blueprint — architectural drawing on blue paper' },
    { key: 'wireframe', label: 'Wire', title: 'Wireframe — black on white, print-friendly' },
  ]
  return (
    <div className="flex items-center rounded-lg overflow-hidden border border-line" role="group" aria-label="View mode">
      {modes.map((m) => (
        <button
          key={m.key}
          className={`px-2.5 py-1 text-xs font-medium transition-colors ${
            value === m.key ? 'bg-accent/20 text-accent' : 'text-subink hover:text-ink hover:bg-white/5'
          }`}
          title={m.title}
          onClick={() => onChange(m.key)}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
