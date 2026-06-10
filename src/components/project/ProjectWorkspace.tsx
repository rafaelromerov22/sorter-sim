// src/components/project/ProjectWorkspace.tsx
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { Header } from '../shared/Header'
import { LinesTabs } from './LinesTabs'
import { ConfigSidebar } from '../config/ConfigSidebar'
import { SimResults } from './SimResults'
import { KpiStrip } from './KpiStrip'
import { ConveyorCanvas } from '../canvas/ConveyorCanvas'
import { useConfigStore } from '../../store/configStore'
import { useProjectStore } from '../../store/projectStore'

type CenterTab = 'results' | 'canvas'

export function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>()

  const { loadConfig, configLoading, simResultsByLine, simLoading, runSimulation,
          isDirty, saveLoading, saveVersion, projectId, activeLineId } =
    useConfigStore(useShallow(s => ({
      loadConfig:        s.loadConfig,
      configLoading:     s.configLoading,
      simResultsByLine:  s.simResultsByLine,
      simLoading:        s.simLoading,
      runSimulation:     s.runSimulation,
      isDirty:           s.isDirty,
      saveLoading:       s.saveLoading,
      saveVersion:       s.saveVersion,
      projectId:         s.projectId,
      activeLineId:      s.activeLineId,
    })))

  const simResults = activeLineId ? simResultsByLine[activeLineId] ?? null : null

  const projects   = useProjectStore(s => s.projects)
  const unitSystem = useProjectStore(s => s.unitSystem)
  const project    = projects.find(p => p.id === id)

  const [centerTab, setCenterTab] = useState<CenterTab>('results')
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!id) return
    loadConfig(id, project?.name ?? 'Untitled Project', project?.unit_system ?? unitSystem)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave 2 s after the last change
  useEffect(() => {
    if (!isDirty || !projectId) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => { saveVersion() }, 2000)
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current) }
  }, [isDirty, projectId]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleRun = () => {
    setCenterTab('results')
    runSimulation()
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
            <div className="shrink-0 flex items-center gap-3 px-3">
              {/* Save status indicator */}
              {projectId && (
                <span className="flex items-center gap-1.5 text-xs">
                  {saveLoading ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                      <span className="text-gray-400">Saving…</span>
                    </>
                  ) : isDirty ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-gray-300" />
                      <span className="text-gray-400">Unsaved</span>
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-green-600">Saved</span>
                    </>
                  )}
                </span>
              )}
              <button
                onClick={handleRun}
                disabled={simLoading}
                className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {simLoading ? 'Running…' : '▶ Run'}
              </button>
            </div>
          </div>

          {/* Results / Canvas view tabs — only shown when results exist */}
          {simResults && !simLoading && (
            <div className="flex border-b border-gray-200 bg-white px-4">
              {(['results', 'canvas'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setCenterTab(tab)}
                  className={`border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    centerTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'canvas' ? 'Canvas' : 'Results'}
                </button>
              ))}
            </div>
          )}

          {/* Content area */}
          <div className="flex flex-1 overflow-hidden bg-gray-100">
            {simLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-gray-400">Running simulation…</p>
              </div>
            ) : simResults ? (
              centerTab === 'canvas' ? (
                <div className="flex-1 overflow-hidden">
                  <ConveyorCanvas />
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <SimResults results={simResults} />
                </div>
              )
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

      </div>
    </div>
  )
}
