// src/utils/validation.test.ts
import { describe, it, expect } from 'vitest'
import { validateLine } from './validation'
import type { ConveyorLineConfig, ExitConfig, ProductSKU } from '../types'

function baseLine(): ConveyorLineConfig {
  return {
    id: 'l1',
    name: 'Line 1',
    conveyor: { length: 1200, width: 36, speed: 2400, minGapDistance: 6, availabilityFactor: 0.88, encoderResolution: 100 },
    exits: [makeExit(0, 30)],
    feed: { mode: 'horizontal', targetPPM: 30, mixedDimensions: false, singulated: true, metered: true, scanReadRate: 0.99, plcLatencyMs: 10 },
    skus: [makeSKU(100)],
    recirculationEnabled: false,
    recirculationDelaySec: 30,
    noReadExitId: null,
    randomSeed: 42,
  }
}

function makeExit(index: number, distanceFromInfeed: number): ExitConfig {
  return {
    id: `e${index}`,
    index,
    side: 'right',
    distanceFromInfeed,
    laneWidth: 3,
    laneLength: 10,
    exitSpeed: 150,
    maxQueueDepth: 10,
    angle: 45,
    diverterType: 'sliding_shoe',
    diverterCycleTime: 0.4,
    diverterExtendTime: 0.2,
    diverterRetractTime: 0.2,
    sensorOffset: 2,
    priority: 0,
  }
}

function makeSKU(distributionPercent: number): ProductSKU {
  return {
    id: 's1',
    name: 'Box A',
    length: 12,
    width: 8,
    height: 6,
    weight: 5,
    orientation: 'long_axis_parallel',
    packagingType: 'rigid_carton',
    cogHeight: 3,
    distributionPercent,
    assignedExitId: 'e0',
    color: '#3b82f6',
  }
}

describe('validateLine', () => {
  it('returns no critical issues for a valid config', () => {
    const results = validateLine(baseLine(), 'imperial')
    const criticals = results.filter(r => r.severity === 'critical')
    expect(criticals).toHaveLength(0)
  })

  it('CRITICAL: SKU distribution does not sum to 100% with 2 SKUs', () => {
    const line = baseLine()
    line.skus = [makeSKU(40), { ...makeSKU(40), id: 's2' }]
    const results = validateLine(line, 'imperial')
    expect(results.some(r => r.severity === 'critical' && r.field === 'skus.distributionPercent')).toBe(true)
  })

  it('CRITICAL: targetPPM exceeds achievable throughput', () => {
    const line = baseLine()
    line.feed.targetPPM = 500  // impossible at 2400 in/min (200 fpm) with 12 in product
    const results = validateLine(line, 'imperial')
    expect(results.some(r => r.severity === 'critical' && r.field === 'feed.targetPPM')).toBe(true)
  })

  it('CRITICAL: SKU shorter than diverter minimum product length', () => {
    const line = baseLine()
    line.skus[0].length = 3  // 3 in < 6 in minimum for sliding_shoe
    const results = validateLine(line, 'imperial')
    expect(results.some(r => r.severity === 'critical' && r.field.startsWith('skus['))).toBe(true)
  })

  it('WARNING: belt speed exceeds diverter recommended maximum', () => {
    const line = baseLine()
    line.conveyor.speed = 6000  // 6000 in/min = 500 fpm > 400 fpm max for sliding_shoe
    const results = validateLine(line, 'imperial')
    expect(results.some(r => r.severity === 'warning' && r.field.startsWith('exits['))).toBe(true)
  })

  it('WARNING: PLC latency > 20 ms at speed > 200 fpm', () => {
    const line = baseLine()
    line.conveyor.speed = 3000  // 3000 in/min = 250 fpm > 200 fpm threshold
    line.feed.plcLatencyMs = 30
    const results = validateLine(line, 'imperial')
    expect(results.some(r => r.severity === 'warning' && r.field === 'feed.plcLatencyMs')).toBe(true)
  })

  it('INFO: all exits on same side', () => {
    const line = baseLine()
    line.exits = [makeExit(0, 20), makeExit(1, 50)]  // both right
    const results = validateLine(line, 'imperial')
    expect(results.some(r => r.severity === 'info')).toBe(true)
  })

  it('no critical errors when there are no SKUs', () => {
    const line = baseLine()
    line.skus = []
    const results = validateLine(line, 'imperial')
    const criticals = results.filter(r => r.severity === 'critical')
    expect(criticals).toHaveLength(0)
  })
})
