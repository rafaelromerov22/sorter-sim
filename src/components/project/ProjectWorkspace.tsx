// src/components/project/ProjectWorkspace.tsx
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Header } from '../shared/Header'
import { LinesTabs } from './LinesTabs'
import { ConfigSidebar } from '../config/ConfigSidebar'
import { VersionHistory } from './VersionHistory'
import { useConfigStore } from '../../store/configStore'
import { useProjectStore } from '../../store/projectStore'

export function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>()
  const loadConfig    = useConfigStore(s => s.loadConfig)
  const configLoading = useConfigStore(s => s.configLoading)
  const projects      = useProjectStore(s => s.projects)
  const unitSystem    = useProjectStore(s => s.unitSystem)

  // Resolve project metadata from cached project list
  const project = projects.find(p => p.id === id)

  useEffect(() => {
    if (!id) return
    const name   = project?.name       ?? 'Untitled Project'
    const system = project?.unit_system ?? unitSystem
    loadConfig(id, name, system)
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

      {/* Main area below header */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Config sidebar (320px) */}
        <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white">
          <ConfigSidebar />
        </aside>

        {/* Centre: Lines tabs + canvas + KPI placeholder */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <LinesTabs />

          {/* Canvas area — Stage 3 placeholder */}
          <div className="flex flex-1 items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="text-4xl text-gray-300">⚙</div>
              <p className="mt-2 text-sm font-medium text-gray-400">
                Simulation Canvas
              </p>
              <p className="text-xs text-gray-300">Coming in Stage 3</p>
            </div>
          </div>

          {/* KPI strip — Stage 4 placeholder */}
          <div className="flex h-24 items-center justify-center border-t border-gray-200 bg-white">
            <p className="text-xs text-gray-300">KPI Dashboard — Stage 4</p>
          </div>
        </div>

        {/* Right: Version history (collapsible) */}
        <VersionHistory />
      </div>
    </div>
  )
}
