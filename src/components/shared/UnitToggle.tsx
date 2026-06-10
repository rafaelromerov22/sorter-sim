// src/components/shared/UnitToggle.tsx
import { useProjectStore } from '../../store/projectStore'
import { useConfigStore } from '../../store/configStore'
import type { UnitSystem } from '../../types'

export function UnitToggle() {
  const unitSystem    = useProjectStore(s => s.unitSystem)
  const setUnitSystem = useProjectStore(s => s.setUnitSystem)
  const convertToSystem = useConfigStore(s => s.convertToSystem)

  function handleToggle(system: UnitSystem) {
    setUnitSystem(system)
    // Convert any loaded config values in-place
    const { projectId } = useConfigStore.getState()
    if (projectId) convertToSystem(system)
  }

  return (
    <div className="flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 text-xs font-medium">
      {(['imperial', 'metric'] as UnitSystem[]).map(sys => (
        <button
          key={sys}
          onClick={() => handleToggle(sys)}
          className={`rounded px-2.5 py-1 capitalize transition-colors ${
            unitSystem === sys
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {sys === 'imperial' ? 'Imperial' : 'Metric'}
        </button>
      ))}
    </div>
  )
}
