import {
  ResponsiveContainer, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { toJamTimelineData } from './chartDataUtils'
import type { SimulationResults } from '../../types'

interface Props { results: SimulationResults }

export function JamTimelineChart({ results }: Props) {
  const data = toJamTimelineData(results)
  if (data.length === 0) return null

  const exitCount = results.exitStats.length

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        Jam Timeline ({data.length} event{data.length !== 1 ? 's' : ''})
      </h3>
      <ResponsiveContainer width="100%" height={140}>
        <ScatterChart margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            type="number"
            dataKey="timeSec"
            name="Time"
            unit="s"
            domain={[0, results.runDurationSec]}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="exitIndex"
            name="Exit"
            domain={[-0.5, exitCount - 0.5]}
            ticks={Array.from({ length: exitCount }, (_, i) => i)}
            tickFormatter={(v: number) => `E${v + 1}`}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ fontSize: 12 }}
            formatter={(value, name) => {
              if (name === 'Time') return [`${Number(value).toFixed(1)}s`, 'Time']
              if (name === 'Exit') return [`Exit ${Number(value) + 1}`, 'Exit']
              return [value, name]
            }}
          />
          <Scatter data={data} fill="#ef4444" opacity={0.8} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
