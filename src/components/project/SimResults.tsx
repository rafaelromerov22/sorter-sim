import type { SimulationResults } from '../../types'

interface Props {
  results: SimulationResults
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-gray-200 bg-white px-4 py-3 text-center">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="mt-1 text-2xl font-semibold tabular-nums text-gray-800">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

export function SimResults({ results }: Props) {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <Kpi label="Actual PPM"    value={results.actualPPM.toFixed(1)} />
        <Kpi label="Max PPM"       value={results.theoreticalMaxPPM.toFixed(1)} />
        <Kpi
          label="Efficiency"
          value={`${results.efficiencyPercent.toFixed(1)}%`}
          sub={results.efficiencyPercent >= 80 ? 'Good' : results.efficiencyPercent >= 50 ? 'Fair' : 'Poor'}
        />
        <Kpi label="Packages"   value={results.totalPackages.toString()} />
        <Kpi label="Jams"       value={results.jamCount.toString()} />
        <Kpi label="No-Reads"   value={results.noReadCount.toString()} />
      </div>

      {/* Exit table */}
      {results.exitStats.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-600">Exit Performance</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-400">
                <th className="pb-1 pr-4">Exit</th>
                <th className="pb-1 pr-4">Packages</th>
                <th className="pb-1 pr-4">PPM</th>
                <th className="pb-1">Jams</th>
              </tr>
            </thead>
            <tbody>
              {results.exitStats.map(e => (
                <tr key={e.exitId} className="border-b border-gray-100">
                  <td className="py-1 pr-4 font-medium">Exit {e.exitIndex + 1}</td>
                  <td className="py-1 pr-4 tabular-nums">{e.packagesProcessed}</td>
                  <td className="py-1 pr-4 tabular-nums">{e.packagesPerMin.toFixed(1)}</td>
                  <td className={`py-1 tabular-nums ${e.jamCount > 0 ? 'text-red-600' : ''}`}>
                    {e.jamCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Jam events */}
      {results.jamEvents.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-600">
            Jam Events ({results.jamEvents.length} shown)
          </h3>
          <div className="space-y-1">
            {results.jamEvents.slice(0, 10).map((j, i) => (
              <div key={i} className="rounded bg-red-50 px-3 py-1.5 text-xs text-red-700">
                t={j.timeSec.toFixed(1)}s · Exit {j.exitIndex + 1} ·{' '}
                gap {j.gapAvailableSec.toFixed(3)}s available, {j.gapRequiredSec.toFixed(3)}s needed
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run metadata */}
      <p className="text-xs text-gray-300">
        Simulated {results.totalPackages} packages over {results.runDurationSec.toFixed(0)}s
        · {results.recirculationCount} recirculated · {results.overflowCount} overflow
      </p>
    </div>
  )
}
