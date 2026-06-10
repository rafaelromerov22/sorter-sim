import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { toExitChartData } from './chartDataUtils'
import type { SimulationResults } from '../../types'

interface Props { results: SimulationResults }

export function ExitThroughputChart({ results }: Props) {
  const data = toExitChartData(results)
  if (data.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Exit Load</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value: number, name: string) =>
              [value, name === 'packages' ? 'Packages' : 'Jams']
            }
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="packages" name="Packages" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="jams"     name="Jams"     fill="#ef4444" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
