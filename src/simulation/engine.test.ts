import { describe, it, expect } from 'vitest'
import { runSimulation } from './engine'
import type { SimInput, SimExit, SimSKU } from './types'

function baseExit(overrides: Partial<SimExit> = {}): SimExit {
  return {
    id: 'exit-1', index: 0,
    distanceFromInfeedFt: 50,
    diverterCycleTimeSec: 0.45,
    maxQueueDepth: 10,
    laneExitSpeedFpm: 150,
    laneLengthFt: 10,
    ...overrides,
  }
}

function baseSKU(overrides: Partial<SimSKU> = {}): SimSKU {
  return {
    id: 'sku-1', name: 'Box A',
    lengthIn: 12, weightLbs: 5,
    distributionPercent: 100,
    assignedExitId: 'exit-1',
    ...overrides,
  }
}

function baseInput(overrides: Partial<SimInput> = {}): SimInput {
  return {
    beltSpeedFpm: 200,
    beltLengthFt: 100,
    minGapIn: 6,
    availabilityFactor: 1.0,
    targetPPM: 20,
    scanReadRate: 1.0,
    plcLatencyMs: 0,
    recirculationEnabled: false,
    recirculationDelaySec: 30,
    noReadExitId: null,
    randomSeed: 42,
    exits: [baseExit()],
    skus: [baseSKU()],
    ...overrides,
  }
}

describe('runSimulation', () => {
  it('runs with no SKUs and no exits — returns zero completedPackages', () => {
    const result = runSimulation(baseInput({ exits: [], skus: [] }))
    expect(result.completedPackages).toBe(0)
    expect(result.totalPackages).toBeGreaterThan(0)
  })

  it('all packages diverted when PPM is well below capacity', () => {
    // 20 PPM, diverter cycle 0.45 s → gap between packages = 3 s >> 0.45 s, no jams
    const result = runSimulation(baseInput({ targetPPM: 20 }))
    expect(result.jamCount).toBe(0)
    expect(result.completedPackages).toBe(result.totalPackages)
    expect(result.actualPPM).toBeCloseTo(20, 0)
  })

  it('detects jams when PPM exceeds diverter capacity', () => {
    // diverterCycleTime = 0.45 s → max 60/0.45 ≈ 133 PPM at this exit
    // We request 150 PPM → many jams
    const result = runSimulation(baseInput({ targetPPM: 150 }))
    expect(result.jamCount).toBeGreaterThan(0)
    expect(result.actualPPM).toBeLessThan(150)
  })

  it('all packages are no-read when scanReadRate is 0 and no handler', () => {
    const result = runSimulation(baseInput({ scanReadRate: 0, noReadExitId: null, recirculationEnabled: false }))
    expect(result.noReadCount).toBe(result.totalPackages)
    expect(result.completedPackages).toBe(0)
  })

  it('routes no-reads to the no-read exit when configured', () => {
    const noReadExit = baseExit({ id: 'no-read-exit', index: 1, distanceFromInfeedFt: 80 })
    const result = runSimulation(baseInput({
      scanReadRate: 0,
      noReadExitId: 'no-read-exit',
      exits: [baseExit(), noReadExit],
    }))
    expect(result.completedPackages).toBe(result.totalPackages)
    const noReadExitStats = result.exitStats.find(e => e.exitId === 'no-read-exit')
    expect(noReadExitStats?.packagesProcessed).toBeGreaterThan(0)
  })

  it('recirculates no-reads when recirculationEnabled and no noReadExit', () => {
    const result = runSimulation(baseInput({
      scanReadRate: 0,
      recirculationEnabled: true,
      noReadExitId: null,
    }))
    expect(result.recirculationCount).toBe(result.totalPackages)
    expect(result.completedPackages).toBe(0)
  })

  it('is deterministic — same seed, same result', () => {
    const a = runSimulation(baseInput({ targetPPM: 80, scanReadRate: 0.95, randomSeed: 7 }))
    const b = runSimulation(baseInput({ targetPPM: 80, scanReadRate: 0.95, randomSeed: 7 }))
    expect(a.completedPackages).toBe(b.completedPackages)
    expect(a.jamCount).toBe(b.jamCount)
    expect(a.noReadCount).toBe(b.noReadCount)
  })

  it('different seeds produce different results', () => {
    const a = runSimulation(baseInput({ targetPPM: 80, scanReadRate: 0.9, randomSeed: 1 }))
    const b = runSimulation(baseInput({ targetPPM: 80, scanReadRate: 0.9, randomSeed: 999 }))
    // Very unlikely to match exactly
    expect(a.noReadCount !== b.noReadCount || a.jamCount !== b.jamCount).toBe(true)
  })

  it('computes efficiencyPercent as actualPPM / theoreticalMaxPPM * 100', () => {
    const result = runSimulation(baseInput({ targetPPM: 20 }))
    const expected = (result.actualPPM / result.theoreticalMaxPPM) * 100
    expect(result.efficiencyPercent).toBeCloseTo(expected, 1)
  })

  it('detects exit lane overflow when queue is full', () => {
    // 1-package queue depth, very fast injection → queue fills immediately
    const tightExit = baseExit({ maxQueueDepth: 1, laneLengthFt: 100, laneExitSpeedFpm: 10 })
    const result = runSimulation(baseInput({
      targetPPM: 60,  // 1 package/sec
      exits: [tightExit],
    }))
    expect(result.overflowCount).toBeGreaterThan(0)
  })

  it('respects availability factor — low availability reduces completedPackages', () => {
    const full  = runSimulation(baseInput({ targetPPM: 30, availabilityFactor: 1.0, randomSeed: 1 }))
    const half  = runSimulation(baseInput({ targetPPM: 30, availabilityFactor: 0.5, randomSeed: 1 }))
    expect(half.completedPackages).toBeLessThan(full.completedPackages)
  })
})
