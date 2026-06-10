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
