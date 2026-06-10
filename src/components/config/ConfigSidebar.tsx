// src/components/config/ConfigSidebar.tsx
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useConfigStore } from '../../store/configStore'
import { useProjectStore } from '../../store/projectStore'
import { ConveyorConfigPanel } from './ConveyorConfigPanel'
import { ExitConfigPanel } from './ExitConfigPanel'
import { ProductConfigPanel } from './ProductConfigPanel'
import { FeedConfigPanel } from './FeedConfigPanel'
import { validateLine } from '../../utils/validation'

type Tab = 'conveyor' | 'exits' | 'products' | 'feed'

const TABS: { id: Tab; label: string }[] = [
  { id: 'conveyor',  label: '① Belt'     },
  { id: 'exits',     label: '② Exits'    },
  { id: 'products',  label: '③ Products' },
  { id: 'feed',      label: '④ Feed'     },
]

export function ConfigSidebar() {
  const [activeTab, setActiveTab] = useState<Tab>('conveyor')

  const { lines, activeLineId, isDirty, saveLoading, saveVersion } = useConfigStore(useShallow(s => ({
    lines:        s.lines,
    activeLineId: s.activeLineId,
    isDirty:      s.isDirty,
    saveLoading:  s.saveLoading,
    saveVersion:  s.saveVersion,
  })))
  const unitSystem = useProjectStore(s => s.unitSystem)

  const line = lines.find(l => l.id === activeLineId)

  if (!line) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-gray-400">
        No line selected.
      </div>
    )
  }

  const validationResults = validateLine(line, unitSystem)
  const criticalCount = validationResults.filter(r => r.severity === 'critical').length
  const warningCount  = validationResults.filter(r => r.severity === 'warning').length

  return (
    <div className="flex h-full flex-col">
      {/* Validation summary bar */}
      {(criticalCount > 0 || warningCount > 0) && (
        <div className="flex items-center gap-2 border-b border-gray-200 bg-amber-50 px-3 py-1.5 text-xs">
          {criticalCount > 0 && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-700">
              {criticalCount} error{criticalCount > 1 ? 's' : ''}
            </span>
          )}
          {warningCount > 0 && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700">
              {warningCount} warning{warningCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-white">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-600 text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'conveyor'  && <ConveyorConfigPanel line={line} />}
        {activeTab === 'exits'     && <ExitConfigPanel     line={line} />}
        {activeTab === 'products'  && <ProductConfigPanel  line={line} />}
        {activeTab === 'feed'      && <FeedConfigPanel     line={line} />}
      </div>

      {/* Save button */}
      <div className="border-t border-gray-200 bg-white p-3">
        <button
          onClick={() => saveVersion()}
          disabled={!isDirty || saveLoading || criticalCount > 0}
          className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {saveLoading
            ? 'Saving…'
            : isDirty
              ? criticalCount > 0
                ? `Fix ${criticalCount} error${criticalCount > 1 ? 's' : ''} before saving`
                : 'Save Version'
              : 'Saved ✓'}
        </button>
      </div>
    </div>
  )
}
