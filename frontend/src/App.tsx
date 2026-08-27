import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from './api/client'
import { Sidebar } from './components/Sidebar'
import { CityCanvas } from './components/CityCanvas'
import { DetailPanel } from './components/DetailPanel'
import { TopBar } from './components/TopBar'
import { useUI } from './store'

export default function App() {
  const components = useQuery({ queryKey: ['components'], queryFn: api.listComponents })
  const connections = useQuery({ queryKey: ['connections'], queryFn: api.listConnections })
  const selectedId = useUI((s) => s.selectedId)
  const focusOn = useUI((s) => s.focusOn)

  // Allow ?focus=<id> in the URL to jump into a subtree on load (nice for demos + links).
  useEffect(() => {
    const url = new URL(window.location.href)
    const id = url.searchParams.get('focus')
    if (id) focusOn(id)
  }, [focusOn])

  if (components.isLoading) return <FullscreenMessage msg="Loading city…" />
  if (components.error) return <FullscreenMessage msg={`Backend unreachable: ${(components.error as Error).message}`} error />

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar components={components.data ?? []} />
        <div className="flex-1 relative">
          <CityCanvas
            components={components.data ?? []}
            connections={connections.data ?? []}
          />
        </div>
        {selectedId && <DetailPanel components={components.data ?? []} />}
      </div>
    </div>
  )
}

function FullscreenMessage({ msg, error }: { msg: string; error?: boolean }) {
  return (
    <div className="h-screen w-screen flex items-center justify-center">
      <div className={`px-4 py-3 rounded-lg border ${error ? 'border-red-500/40 text-red-200 bg-red-950/40' : 'border-slate-700 text-slate-200 bg-slate-900/60'}`}>
        {msg}
      </div>
    </div>
  )
}
