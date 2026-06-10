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
