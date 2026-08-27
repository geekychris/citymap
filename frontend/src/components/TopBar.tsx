import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { Building2, Download, FileCode, Plus, RefreshCw } from 'lucide-react'
import { useUI } from '../store'

export function TopBar() {
  const qc = useQueryClient()
  const focusOn = useUI((s) => s.focusOn)

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
    // The backend renders a self-contained HTML file for the current DB state.
    window.location.href = '/api/export/html?download=true'
  }

  return (
    <header className="h-12 flex items-center gap-3 px-4 border-b border-line bg-panel/80 backdrop-blur">
      <div className="flex items-center gap-2 font-semibold">
        <Building2 size={18} className="text-accent" />
        <span>CityMap</span>
        <span className="text-subink text-xs font-normal">TOGAF component explorer</span>
      </div>
      <div className="flex-1" />
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
