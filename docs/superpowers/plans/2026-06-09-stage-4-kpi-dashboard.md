# Stage 4: KPI Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder bottom strip and plain-table results panel with a rich KPI dashboard — bar chart of exit load distribution, donut chart of package outcomes, scatter plot of jam events, and a persistent bottom KPI strip showing live metrics.

**Architecture:** Install Recharts as the charting library. Extract all data-transformation logic into pure functions in `chartDataUtils.ts` (fully unit-tested). Three chart components consume those transforms and render via Recharts. A `KpiStrip` component lives in the bottom slot of `ProjectWorkspace`. The existing `SimResults.tsx` is restructured to show charts above the existing exit table and jam list.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Recharts 2.x, Vitest

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `src/components/charts/chartDataUtils.ts` | Create | Pure transforms: SimulationResults → chart-ready arrays |
| `src/components/charts/chartDataUtils.test.ts` | Create | Unit tests for all transforms |
| `src/components/charts/ExitThroughputChart.tsx` | Create | Bar chart — packages + PPM per exit |
| `src/components/charts/OutcomeDonutChart.tsx` | Create | Donut chart — package outcome breakdown |
| `src/components/charts/JamTimelineChart.tsx` | Create | Scatter plot — jam events over time |
| `src/components/project/KpiStrip.tsx` | Create | Persistent bottom strip; reads configStore.simResults |
| `src/components/project/SimResults.tsx` | Modify | Add chart row above existing table/events |
| `src/components/project/ProjectWorkspace.tsx` | Modify | Replace placeholder `<div>` with `<KpiStrip />` |

---

### Task 1: Install Recharts

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install Recharts**

```
npm install recharts
```

Expected output: `added N packages` with `recharts` in dependencies.

- [ ] **Step 2: Verify TypeScript types resolve**

Recharts ships its own types. Verify with:

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add package.json package-lock.json
git commit -m "chore: add recharts for KPI dashboard charts"
```

---

### Task 2: Chart data utility functions

**Files:**
- Create: `src/components/charts/chartDataUtils.ts`
- Create: `src/components/charts/chartDataUtils.test.ts`

These are pure functions with no React or DOM dependency — straightforward to test.

- [ ] **Step 1: Write failing tests**

Create `src/components/charts/chartDataUtils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  toExitChartData,
  toOutcomeChartData,
  toJamTimelineData,
} from './chartDataUtils'
import type { SimulationResults } from '../../types'

const BASE: SimulationResults = {
  runDurationSec: 300,
  totalPackages: 100,
  completedPackages: 80,
  jamCount: 5,
  noReadCount: 3,
  unroutedCount: 2,
  recirculationCount: 1,
  overflowCount: 9,
  actualPPM: 16,
  theoreticalMaxPPM: 40,
  efficiencyPercent: 40,
  exitStats: [
    { exitId: 'e1', exitIndex: 0, packagesProcessed: 51, packagesPerMin: 10.2, jamCount: 2, queueOverflows: 1 },
    { exitId: 'e2', exitIndex: 1, packagesProcessed: 29, packagesPerMin: 5.8, jamCount: 3, queueOverflows: 0 },
  ],
  jamEvents: [
    { timeSec: 10.5, exitId: 'e1', exitIndex: 0, packageId: 7, gapAvailableSec: 0.2, gapRequiredSec: 0.5 },
    { timeSec: 55.2, exitId: 'e2', exitIndex: 1, packageId: 22, gapAvailableSec: 0.1, gapRequiredSec: 0.4 },
  ],
}

describe('toExitChartData', () => {
  it('maps each exitStat to a labelled bar entry', () => {
    const result = toExitChartData(BASE)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ name: 'Exit 1', packages: 51, ppm: 10.2, jams: 2 })
    expect(result[1]).toEqual({ name: 'Exit 2', packages: 29, ppm: 5.8, jams: 3 })
  })

  it('returns empty array when no exits', () => {
    expect(toExitChartData({ ...BASE, exitStats: [] })).toEqual([])
  })
})

describe('toOutcomeChartData', () => {
  it('builds 6 slices with correct values and only includes non-zero slices', () => {
    const result = toOutcomeChartData(BASE)
    // completedPackages=80, jamCount=5, noReadCount=3, unroutedCount=2, recirculationCount=1, overflowCount=9
    expect(result.find(d => d.name === 'Diverted')?.value).toBe(80)
    expect(result.find(d => d.name === 'Jammed')?.value).toBe(5)
    expect(result.find(d => d.name === 'No-Read')?.value).toBe(3)
    expect(result.find(d => d.name === 'Unrouted')?.value).toBe(2)
    expect(result.find(d => d.name === 'Recirculated')?.value).toBe(1)
    expect(result.find(d => d.name === 'Overflow')?.value).toBe(9)
    // all have a color string
    result.forEach(d => expect(typeof d.color).toBe('string'))
  })

  it('omits slices with value 0', () => {
    const result = toOutcomeChartData({ ...BASE, jamCount: 0, overflowCount: 0 })
    expect(result.find(d => d.name === 'Jammed')).toBeUndefined()
    expect(result.find(d => d.name === 'Overflow')).toBeUndefined()
  })
})

describe('toJamTimelineData', () => {
  it('maps jam events to scatter points', () => {
    const result = toJamTimelineData(BASE)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ timeSec: 10.5, exitLabel: 'Exit 1', exitIndex: 0, gapRatio: expect.any(Number) })
    expect(result[1]).toEqual({ timeSec: 55.2, exitLabel: 'Exit 2', exitIndex: 1, gapRatio: expect.any(Number) })
  })

  it('gapRatio is gapRequired / gapAvailable', () => {
    const result = toJamTimelineData(BASE)
    // 0.5/0.2 = 2.5
    expect(result[0].gapRatio).toBeCloseTo(2.5)
  })

  it('returns empty array when no jam events', () => {
    expect(toJamTimelineData({ ...BASE, jamEvents: [] })).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npx vitest run src/components/charts/chartDataUtils.test.ts
```

Expected: FAIL — "Cannot find module './chartDataUtils'"

- [ ] **Step 3: Implement chartDataUtils.ts**

Create `src/components/charts/chartDataUtils.ts`:

```typescript
import type { SimulationResults } from '../../types'

export interface ExitChartEntry {
  name: string
  packages: number
  ppm: number
  jams: number
}

export interface OutcomeChartEntry {
  name: string
  value: number
  color: string
}

export interface JamTimelineEntry {
  timeSec: number
  exitLabel: string
  exitIndex: number
  gapRatio: number
}

export function toExitChartData(r: SimulationResults): ExitChartEntry[] {
  return r.exitStats.map(e => ({
    name: `Exit ${e.exitIndex + 1}`,
    packages: e.packagesProcessed,
    ppm: e.packagesPerMin,
    jams: e.jamCount,
  }))
}

const OUTCOME_COLORS: Record<string, string> = {
  Diverted:     '#22c55e',
  Jammed:       '#ef4444',
  'No-Read':    '#f97316',
  Unrouted:     '#eab308',
  Recirculated: '#3b82f6',
  Overflow:     '#a855f7',
}

export function toOutcomeChartData(r: SimulationResults): OutcomeChartEntry[] {
  const raw: [string, number][] = [
    ['Diverted',     r.completedPackages],
    ['Jammed',       r.jamCount],
    ['No-Read',      r.noReadCount],
    ['Unrouted',     r.unroutedCount],
    ['Recirculated', r.recirculationCount],
    ['Overflow',     r.overflowCount],
  ]
  return raw
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value, color: OUTCOME_COLORS[name] }))
}

export function toJamTimelineData(r: SimulationResults): JamTimelineEntry[] {
  return r.jamEvents.map(j => ({
    timeSec:   j.timeSec,
    exitLabel: `Exit ${j.exitIndex + 1}`,
    exitIndex: j.exitIndex,
    gapRatio:  j.gapAvailableSec > 0 ? j.gapRequiredSec / j.gapAvailableSec : 0,
  }))
}
```

- [ ] **Step 4: Run tests — expect PASS**

```
npx vitest run src/components/charts/chartDataUtils.test.ts
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```
git add src/components/charts/chartDataUtils.ts src/components/charts/chartDataUtils.test.ts
git commit -m "feat: chart data utility functions with tests"
```

---

### Task 3: Exit Throughput Bar Chart

**Files:**
- Create: `src/components/charts/ExitThroughputChart.tsx`

Grouped bar chart — one bar per exit, showing package count. A second bar shows jam count on the same axis (small values, different colour). Uses `ResponsiveContainer` so it fills its parent.

- [ ] **Step 1: Implement ExitThroughputChart.tsx**

```tsx
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add src/components/charts/ExitThroughputChart.tsx
git commit -m "feat: ExitThroughputChart bar chart component"
```

---

### Task 4: Package Outcome Donut Chart

**Files:**
- Create: `src/components/charts/OutcomeDonutChart.tsx`

Pie chart with `innerRadius` (donut) showing the breakdown of all simulated packages by outcome. Each slice is colour-coded. A centre label shows total packages.

- [ ] **Step 1: Implement OutcomeDonutChart.tsx**

```tsx
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
            formatter={(value: number, name: string) => [value, name]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add src/components/charts/OutcomeDonutChart.tsx
git commit -m "feat: OutcomeDonutChart package outcome breakdown"
```

---

### Task 5: Jam Timeline Scatter Plot

**Files:**
- Create: `src/components/charts/JamTimelineChart.tsx`

Scatter chart with time on X axis and exit number on Y axis. Each point represents one jam event. Only rendered when `jamEvents.length > 0`.

- [ ] **Step 1: Implement JamTimelineChart.tsx**

```tsx
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
            domain={[0, 300]}
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
            formatter={(value: number, name: string) => {
              if (name === 'Time') return [`${value.toFixed(1)}s`, 'Time']
              if (name === 'Exit') return [`Exit ${(value as number) + 1}`, 'Exit']
              return [value, name]
            }}
          />
          <Scatter data={data} fill="#ef4444" opacity={0.8} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add src/components/charts/JamTimelineChart.tsx
git commit -m "feat: JamTimelineChart scatter plot of jam events"
```

---

### Task 6: KPI Strip

**Files:**
- Create: `src/components/project/KpiStrip.tsx`

Persistent bottom bar always visible in the workspace. Reads `simResults` directly from `configStore` via `useShallow`. Shows `--` placeholders when no simulation has been run yet. Replaces the placeholder `<div>` in `ProjectWorkspace`.

- [ ] **Step 1: Implement KpiStrip.tsx**

```tsx
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
      <Tile label="Max PPM"     value={fmt(simResults?.theoreticalMaxPPM)}   />
      <Tile label="Efficiency"  value={simResults ? `${fmt(simResults.efficiencyPercent)}%` : '--'} />
      <Tile label="Packages"    value={simResults?.totalPackages.toString() ?? '--'} />
      <Tile label="Jams"        value={simResults?.jamCount.toString() ?? '--'} />
      <Tile label="No-Reads"    value={simResults?.noReadCount.toString() ?? '--'} />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add src/components/project/KpiStrip.tsx
git commit -m "feat: KpiStrip persistent bottom metrics bar"
```

---

### Task 7: Wire charts into SimResults and KpiStrip into ProjectWorkspace

**Files:**
- Modify: `src/components/project/SimResults.tsx`
- Modify: `src/components/project/ProjectWorkspace.tsx`

Add a two-column chart row at the top of SimResults (ExitThroughputChart left, OutcomeDonutChart right). JamTimelineChart appears below that when there are jams. Replace the bottom placeholder `<div>` in ProjectWorkspace with `<KpiStrip />`.

- [ ] **Step 1: Update SimResults.tsx**

Replace the full file content of `src/components/project/SimResults.tsx`:

```tsx
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
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <Kpi label="Actual PPM"    value={results.actualPPM.toFixed(1)} />
        <Kpi label="Max PPM"       value={results.theoreticalMaxPPM.toFixed(1)} />
        <Kpi
          label="Efficiency"
          value={`${results.efficiencyPercent.toFixed(1)}%`}
          sub={results.efficiencyPercent >= 80 ? 'Good' : results.efficiencyPercent >= 50 ? 'Fair' : 'Poor'}
        />
        <Kpi label="Packages"  value={results.totalPackages.toString()} />
        <Kpi label="Jams"      value={results.jamCount.toString()} />
        <Kpi label="No-Reads"  value={results.noReadCount.toString()} />
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
```

- [ ] **Step 2: Update ProjectWorkspace.tsx — import KpiStrip and replace placeholder**

The only change needed is: add the import and swap the bottom `<div>` for `<KpiStrip />`.

In `src/components/project/ProjectWorkspace.tsx`:

Add import (after existing imports):
```tsx
import { KpiStrip } from './KpiStrip'
```

Replace:
```tsx
          {/* KPI strip — Stage 4 placeholder */}
          <div className="flex h-16 items-center justify-center border-t border-gray-200 bg-white">
            <p className="text-xs text-gray-300">KPI Dashboard — Stage 4</p>
          </div>
```

With:
```tsx
          <KpiStrip />
```

- [ ] **Step 3: Run full test suite**

```
npx vitest run
```

Expected: all existing tests pass (74+) plus the new chartDataUtils tests (8 new).

- [ ] **Step 4: TypeScript clean build**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```
git add src/components/project/SimResults.tsx \
        src/components/project/ProjectWorkspace.tsx
git commit -m "feat: wire chart components and KpiStrip into workspace"
```

---

## Self-Review

### 1. Spec coverage
- ✅ Exit load distribution bar chart → Task 3 (ExitThroughputChart)
- ✅ Package outcome donut → Task 4 (OutcomeDonutChart)
- ✅ Jam events scatter plot → Task 5 (JamTimelineChart)
- ✅ Persistent bottom KPI strip → Task 6 (KpiStrip)
- ✅ Charts wired into workspace → Task 7
- ✅ Pure data transforms unit tested → Task 2

### 2. Placeholder scan
None found.

### 3. Type consistency
- `ExitChartEntry`, `OutcomeChartEntry`, `JamTimelineEntry` defined in Task 2 and imported in Tasks 3–5 ✅
- `SimulationResults` imported from `../../types` consistently across all files ✅
- `useShallow` from `zustand/react/shallow` used in KpiStrip (matches existing pattern in the codebase) ✅
