// src/components/project/ProjectWorkspace.tsx
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { Header } from '../shared/Header'
import { LinesTabs } from './LinesTabs'
import { ConfigSidebar } from '../config/ConfigSidebar'
import { VersionHistory } from './VersionHistory'
import { SimResults } from './SimResults'
import { useConfigStore } from '../../store/configStore'
import { useProjectStore } from '../../store/projectStore'
import { KpiStrip } from './KpiStrip'

export function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>()

  const { loadConfig, configLoading, simResults, simLoading, runSimulation } =
    useConfigStore(useShallow(s => ({
      loadConfig:    s.loadConfig,
      configLoading: s.configLoading,
      simResults:    s.simResults,
      simLoading:    s.simLoading,
      runSimulation: s.runSimulation,
    })))

  const projects   = useProjectStore(s => s.projects)
  const unitSystem = useProjectStore(s => s.unitSystem)
  const project    = projects.find(p => p.id === id)

  useEffect(() => {
    if (!id) return
    loadConfig(id, project?.name ?? 'Untitled Project', project?.unit_system ?? unitSystem)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (configLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-gray-400">Loading project…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Config sidebar */}
        <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white">
          <ConfigSidebar />
        </aside>

        {/* Centre */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Line tabs + Run button */}
          <div className="flex items-center border-b border-gray-200 bg-white">
            <div className="flex-1 overflow-hidden">
              <LinesTabs />
            </div>
            <div className="shrink-0 px-3">
              <button
                onClick={() => runSimulation()}
                disabled={simLoading}
                className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {simLoading ? 'Running…' : '▶ Run'}
              </button>
            </div>
          </div>

          {/* Canvas / results area */}
          <div className="flex flex-1 overflow-hidden bg-gray-100">
            {simLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-gray-400">Running simulation…</p>
              </div>
            ) : simResults ? (
              <div className="flex-1 overflow-y-auto">
                <SimResults results={simResults} />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl text-gray-300">▶</div>
                  <p className="mt-2 text-sm font-medium text-gray-400">Press Run to simulate</p>
                  <p className="text-xs text-gray-300">Configure the belt, exits, and products first</p>
                </div>
              </div>
            )}
          </div>

          <KpiStrip />
        </div>

        {/* Right: Version history */}
        <VersionHistory />
      </div>
    </div>
  )
}
