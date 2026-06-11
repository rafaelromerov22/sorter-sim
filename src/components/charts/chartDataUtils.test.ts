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
  diverterJamCount: 4,
  mechanicalJamCount: 1,
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
    expect(result.find(d => d.name === 'Diverted')?.value).toBe(80)
    expect(result.find(d => d.name === 'Jammed')?.value).toBe(5)
    expect(result.find(d => d.name === 'No-Read')?.value).toBe(3)
    expect(result.find(d => d.name === 'Unrouted')?.value).toBe(2)
    expect(result.find(d => d.name === 'Recirculated')?.value).toBe(1)
    expect(result.find(d => d.name === 'Overflow')?.value).toBe(9)
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
    expect(result[0].gapRatio).toBeCloseTo(2.5)
  })

  it('returns empty array when no jam events', () => {
    expect(toJamTimelineData({ ...BASE, jamEvents: [] })).toEqual([])
  })
})
