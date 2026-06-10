import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
} from 'recharts'
import { toOutcomeChartData } from './chartDataUtils'
import type { SimulationResults } from '../../types'

interface Props { results: SimulationResults }

export function OutcomeDonutChart({ results }: Props) {
  const data = toOutcomeChartData(results)
  if (data.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Outcomes</h3>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={72}
            dataKey="value"
            nameKey="name"
            paddingAngle={2}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value, name) => [value, name]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
