import type { SimulationResults } from '../../types'
import { ExitThroughputChart } from '../charts/ExitThroughputChart'
import { OutcomeDonutChart } from '../charts/OutcomeDonutChart'
import { JamTimelineChart } from '../charts/JamTimelineChart'

interface Props {
  results: SimulationResults
}

function Kpi({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`flex flex-col items-center rounded-lg border px-4 py-3 text-center ${warn ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`mt-1 text-2xl font-semibold tabular-nums ${warn ? 'text-amber-700' : 'text-gray-800'}`}>{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

export function SimResults({ results }: Props) {
  const hasUnrouted = results.unroutedCount > 0

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4">
      {/* Unrouted warning banner */}
      {hasUnrouted && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">{results.unroutedCount} packages unrouted</span> — their SKUs were scanned
          successfully but have no exit assigned. Go to the Products tab and assign each SKU to an exit.
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Actual PPM" value={results.actualPPM.toFixed(1)} />
        <Kpi label="Packages"   value={results.totalPackages.toString()} />
        <Kpi label="Jams"       value={results.jamCount.toString()} />
        <Kpi label="No-Reads"   value={results.noReadCount.toString()} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <ExitThroughputChart results={results} />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <OutcomeDonutChart results={results} />
        </div>
      </div>

      {/* Jam timeline — only when jams exist */}
      {results.jamEvents.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <JamTimelineChart results={results} />
        </div>
      )}

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

      {/* Jam events list */}
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
        · {results.unroutedCount} unrouted · {results.recirculationCount} recirculated · {results.overflowCount} overflow
      </p>
    </div>
  )
}
