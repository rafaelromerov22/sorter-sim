import { useShallow } from 'zustand/react/shallow'
import { useConfigStore } from '../../store/configStore'

interface TileProps { label: string; value: string; highlight?: boolean }

function Tile({ label, value, highlight }: TileProps) {
  return (
    <div className="flex flex-col items-center px-5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</span>
      <span className={`text-lg font-semibold tabular-nums leading-tight ${highlight ? 'text-blue-600' : 'text-gray-700'}`}>
        {value}
      </span>
    </div>
  )
}

export function KpiStrip() {
  const { simResults } = useConfigStore(useShallow(s => ({ simResults: s.simResults })))

  const fmt = (n: number | undefined, decimals = 1) =>
    n !== undefined ? n.toFixed(decimals) : '--'

  return (
    <div className="flex h-16 items-center justify-center gap-1 divide-x divide-gray-100 border-t border-gray-200 bg-white">
      <Tile label="Actual PPM"  value={fmt(simResults?.actualPPM)}           highlight />
      <Tile label="Packages"    value={simResults?.totalPackages.toString() ?? '--'} />
      <Tile label="Sorted"      value={simResults?.completedPackages.toString() ?? '--'} />
      <Tile label="Jams"        value={simResults?.jamCount.toString() ?? '--'} />
      <Tile label="No-Reads"    value={simResults?.noReadCount.toString() ?? '--'} />
      <Tile label="Run Duration" value={simResults ? `${Math.round(simResults.runDurationSec / 60)} min` : '--'} />
    </div>
  )
}
