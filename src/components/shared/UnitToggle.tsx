import { useProjectStore } from '../../store/projectStore'

export function UnitToggle() {
  const { unitSystem, setUnitSystem } = useProjectStore()

  const handleToggle = () => {
    setUnitSystem(unitSystem === 'imperial' ? 'metric' : 'imperial')
  }

  return (
    <button
      onClick={handleToggle}
      className="flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      title={`Switch to ${unitSystem === 'imperial' ? 'metric' : 'imperial'} units`}
    >
      <span className={unitSystem === 'imperial' ? 'text-blue-600 font-semibold' : 'text-gray-400'}>
        ft
      </span>
      <span className="text-gray-300">/</span>
      <span className={unitSystem === 'metric' ? 'text-blue-600 font-semibold' : 'text-gray-400'}>
        m
      </span>
      <span className="ml-1 text-xs uppercase tracking-wide">
        {unitSystem === 'imperial' ? 'Imperial' : 'Metric'}
      </span>
    </button>
  )
}
