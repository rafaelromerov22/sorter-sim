import { describe, it, expect } from 'vitest'
import { toSimInput } from './configAdapter'
import type { ConveyorLineConfig } from '../types'

function makeImperialLine(overrides: Partial<ConveyorLineConfig> = {}): ConveyorLineConfig {
  return {
    id: 'line-1',
    name: 'Line 1',
    conveyor: {
      length: 100, width: 3, speed: 200,
      minGapDistance: 6, availabilityFactor: 0.88, encoderResolution: 100,
    },
    exits: [],
    feed: {
      mode: 'horizontal', targetPPM: 30, mixedDimensions: false,
      singulated: true, metered: true, scanReadRate: 0.99, plcLatencyMs: 10,
    },
    skus: [],
    recirculationEnabled: false,
    recirculationDelaySec: 30,
    noReadExitId: null,
    randomSeed: 42,
    ...overrides,
  }
}

describe('toSimInput', () => {
  it('passes imperial values through unchanged', () => {
    const input = toSimInput(makeImperialLine(), 'imperial')
    expect(input.beltSpeedFpm).toBe(200)
    expect(input.minGapIn).toBe(6)
    expect(input.targetPPM).toBe(30)
    expect(input.randomSeed).toBe(42)
  })

  it('converts metric belt speed and gap to imperial', () => {
    const line = makeImperialLine()
    line.conveyor.speed = 60.96           // m/min ≈ 200 ft/min
    line.conveyor.minGapDistance = 152.4  // mm = 6 in
    const input = toSimInput(line, 'metric')
    expect(input.beltSpeedFpm).toBeCloseTo(200, 0)
    expect(input.minGapIn).toBeCloseTo(6, 0)
  })

  it('maps exit fields to SimExit correctly', () => {
    const line = makeImperialLine({
      exits: [{
        id: 'exit-1', index: 0, side: 'right',
        distanceFromInfeed: 30, laneWidth: 3, laneLength: 10,
        exitSpeed: 150, maxQueueDepth: 8, angle: 45,
        diverterType: 'sliding_shoe', diverterCycleTime: 0.45,
        diverterExtendTime: 0.225, diverterRetractTime: 0.225,
        sensorOffset: 2, priority: 0,
      }],
    })
    const input = toSimInput(line, 'imperial')
    expect(input.exits).toHaveLength(1)
    expect(input.exits[0].distanceFromInfeedFt).toBe(30)
    expect(input.exits[0].diverterCycleTimeSec).toBe(0.45)
    expect(input.exits[0].maxQueueDepth).toBe(8)
    expect(input.exits[0].laneExitSpeedFpm).toBe(150)
    expect(input.exits[0].laneLengthFt).toBe(10)
  })

  it('maps SKU fields to SimSKU correctly', () => {
    const line = makeImperialLine({
      skus: [{
        id: 'sku-1', name: 'Box A', length: 12, width: 8, height: 6,
        weight: 5, orientation: 'long_axis_parallel', packagingType: 'rigid_carton',
        cogHeight: 3, distributionPercent: 100, assignedExitId: 'exit-1', color: '#fff',
      }],
    })
    const input = toSimInput(line, 'imperial')
    expect(input.skus).toHaveLength(1)
    expect(input.skus[0].lengthIn).toBe(12)
    expect(input.skus[0].weightLbs).toBe(5)
    expect(input.skus[0].assignedExitId).toBe('exit-1')
  })

  it('converts metric SKU length and weight to imperial', () => {
    const line = makeImperialLine({
      skus: [{
        id: 'sku-1', name: 'Box A', length: 304.8, width: 200, height: 150,
        weight: 2.268, orientation: 'long_axis_parallel', packagingType: 'rigid_carton',
        cogHeight: 75, distributionPercent: 100, assignedExitId: null, color: '#fff',
      }],
    })
    const input = toSimInput(line, 'metric')
    expect(input.skus[0].lengthIn).toBeCloseTo(12, 0)   // 304.8 mm = 12 in
    expect(input.skus[0].weightLbs).toBeCloseTo(5, 0)   // 2.268 kg ≈ 5 lbs
  })
})
