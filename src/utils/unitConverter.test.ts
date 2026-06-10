// src/utils/unitConverter.test.ts
import { describe, it, expect } from 'vitest'
import {
  ftToM, mToFt,
  inToMm, mmToIn,
  lbsToKg, kgToLbs,
  fpmToMpm, mpmToFpm,
  unitLabel,
  convertLineConfig,
} from './unitConverter'
import type { ConveyorLineConfig } from '../types'

describe('unitConverter', () => {
  it('ftToM: 1 ft = 0.3048 m', () => {
    expect(ftToM(1)).toBeCloseTo(0.3048, 6)
  })

  it('mToFt: round-trip within 6 decimal places', () => {
    expect(mToFt(ftToM(100))).toBeCloseTo(100, 6)
  })

  it('inToMm: 1 in = 25.4 mm', () => {
    expect(inToMm(1)).toBe(25.4)
  })

  it('mmToIn: 25.4 mm = 1 in', () => {
    expect(mmToIn(25.4)).toBe(1)
  })

  it('lbsToKg: 1 lb ≈ 0.453592 kg', () => {
    expect(lbsToKg(1)).toBeCloseTo(0.453592, 5)
  })

  it('kgToLbs: round-trip within 5 decimal places', () => {
    expect(kgToLbs(lbsToKg(50))).toBeCloseTo(50, 5)
  })

  it('fpmToMpm: 100 ft/min = 30.48 m/min', () => {
    expect(fpmToMpm(100)).toBeCloseTo(30.48, 6)
  })

  it('unitLabel: speed imperial = ft/min', () => {
    expect(unitLabel('speed', 'imperial')).toBe('ft/min')
  })

  it('unitLabel: speed metric = m/min', () => {
    expect(unitLabel('speed', 'metric')).toBe('m/min')
  })

  it('unitLabel: smallLength metric = mm', () => {
    expect(unitLabel('smallLength', 'metric')).toBe('mm')
  })

  it('convertLineConfig: imperial→metric converts conveyor speed', () => {
    const line = makeMinimalLine()
    line.conveyor.speed = 200  // ft/min
    const converted = convertLineConfig(line, 'imperial', 'metric')
    expect(converted.conveyor.speed).toBeCloseTo(fpmToMpm(200), 5)
  })

  it('convertLineConfig: same system returns unchanged values', () => {
    const line = makeMinimalLine()
    line.conveyor.speed = 200
    const converted = convertLineConfig(line, 'imperial', 'imperial')
    expect(converted.conveyor.speed).toBe(200)
  })

  it('convertLineConfig: imperial→metric converts exit distanceFromInfeed', () => {
    const line = makeMinimalLine()
    line.exits = [{
      id: 'e1', index: 0, side: 'right', distanceFromInfeed: 20,
      laneWidth: 3, laneLength: 10, exitSpeed: 150, maxQueueDepth: 10,
      angle: 45, diverterType: 'sliding_shoe', diverterCycleTime: 0.4,
      diverterExtendTime: 0.2, diverterRetractTime: 0.2, sensorOffset: 2, priority: 0,
    }]
    const converted = convertLineConfig(line, 'imperial', 'metric')
    expect(converted.exits[0].distanceFromInfeed).toBeCloseTo(ftToM(20), 5)
    // diverterCycleTime must NOT be converted (it's in seconds)
    expect(converted.exits[0].diverterCycleTime).toBe(0.4)
  })

  it('convertLineConfig: imperial→metric converts SKU dimensions and weight', () => {
    const line = makeMinimalLine()
    line.skus = [{
      id: 's1', name: 'Box', length: 12, width: 8, height: 6, weight: 5,
      orientation: 'long_axis_parallel', packagingType: 'rigid_carton',
      cogHeight: 3, distributionPercent: 100, assignedExitId: null, color: '#3b82f6',
    }]
    const converted = convertLineConfig(line, 'imperial', 'metric')
    expect(converted.skus[0].length).toBeCloseTo(inToMm(12), 5)
    expect(converted.skus[0].weight).toBeCloseTo(lbsToKg(5), 5)
    // distributionPercent must NOT be converted
    expect(converted.skus[0].distributionPercent).toBe(100)
  })
})

function makeMinimalLine(): ConveyorLineConfig {
  return {
    id: 'l1',
    name: 'Line 1',
    conveyor: { length: 100, width: 3, speed: 200, minGapDistance: 6, availabilityFactor: 0.88, encoderResolution: 100 },
    exits: [],
    feed: { mode: 'horizontal', targetPPM: 30, mixedDimensions: false, singulated: true, metered: true, scanReadRate: 0.99, plcLatencyMs: 10 },
    skus: [],
    recirculationEnabled: false,
    recirculationDelaySec: 30,
    noReadExitId: null,
    randomSeed: 42,
  }
}
