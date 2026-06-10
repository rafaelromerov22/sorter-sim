// src/components/canvas/canvasGeometry.test.ts
import { describe, it, expect } from 'vitest'
import {
  packageBeltXFt,
  isOnBelt,
  isInExitLane,
  lanePositionOf,
} from './canvasGeometry'
import type { SimPackage } from '../../simulation/types'

function pkg(overrides: Partial<SimPackage> = {}): SimPackage {
  return {
    id: 0,
    skuId: 'sku1',
    skuName: 'SKU 1',
    lengthFt: 1,
    infeedTimeSec: 10,
    scanSuccess: true,
    assignedExitId: 'exit1',
    arrivalAtDiverterSec: 20,
    outcome: 'diverted',
    ...overrides,
  }
}

describe('packageBeltXFt', () => {
  it('returns null before infeed time', () => {
    expect(packageBeltXFt(pkg({ infeedTimeSec: 10 }), 5, 120)).toBeNull()
  })
  it('returns 0 at exact infeed time', () => {
    expect(packageBeltXFt(pkg({ infeedTimeSec: 10 }), 10, 120)).toBe(0)
  })
  it('returns correct distance: 120 fpm = 2 fps, 5 s → 10 ft', () => {
    expect(packageBeltXFt(pkg({ infeedTimeSec: 0 }), 5, 120)).toBeCloseTo(10)
  })
})

describe('isOnBelt', () => {
  it('false before infeed', () => {
    expect(isOnBelt(pkg({ infeedTimeSec: 10, arrivalAtDiverterSec: 20 }), 5, 100, 120)).toBe(false)
  })
  it('true while travelling toward diverter', () => {
    expect(isOnBelt(pkg({ infeedTimeSec: 10, arrivalAtDiverterSec: 20 }), 15, 100, 120)).toBe(true)
  })
  it('false at arrival time (package has diverted)', () => {
    expect(isOnBelt(pkg({ infeedTimeSec: 10, arrivalAtDiverterSec: 20 }), 20, 100, 120)).toBe(false)
  })
  it('false when leading edge exits belt end (no diverter)', () => {
    expect(isOnBelt(pkg({ infeedTimeSec: 0, arrivalAtDiverterSec: null, outcome: 'no_read' }), 60, 100, 120)).toBe(false)
  })
  it('true for no-read package still within belt length', () => {
    expect(isOnBelt(pkg({ infeedTimeSec: 0, arrivalAtDiverterSec: null, outcome: 'no_read' }), 30, 100, 120)).toBe(true)
  })
  it('false at exactly belt length (leading edge at boundary)', () => {
    // 120fpm=2fps; infeed at 0; at t=50 x=100ft === beltLength
    expect(isOnBelt(pkg({ infeedTimeSec: 0, arrivalAtDiverterSec: null, outcome: 'no_read' }), 50, 100, 120)).toBe(false)
  })
  it('true for package with exit beyond belt length, before arrival', () => {
    // exit at 150ft, beltLength=100ft — package stays on belt until arrivalAtDiverterSec
    // at t=60, x=120ft > beltLength but simTime(60) < arrivalAtDiverterSec(75)
    expect(isOnBelt(pkg({ infeedTimeSec: 0, arrivalAtDiverterSec: 75, outcome: 'diverted' }), 60, 100, 120)).toBe(true)
  })
})

describe('isInExitLane', () => {
  it('true for diverted package after arrival', () => {
    expect(isInExitLane(pkg({ outcome: 'diverted', arrivalAtDiverterSec: 20 }), 21)).toBe(true)
  })
  it('false before arrival', () => {
    expect(isInExitLane(pkg({ outcome: 'diverted', arrivalAtDiverterSec: 20 }), 19)).toBe(false)
  })
  it('false for jammed outcome', () => {
    expect(isInExitLane(pkg({ outcome: 'jammed', arrivalAtDiverterSec: 20 }), 21)).toBe(false)
  })
  it('false for no_read outcome', () => {
    expect(isInExitLane(pkg({ outcome: 'no_read', arrivalAtDiverterSec: null }), 30)).toBe(false)
  })
  it('false for overflow outcome', () => {
    expect(isInExitLane(pkg({ outcome: 'overflow', arrivalAtDiverterSec: 20 }), 21)).toBe(false)
  })
})

describe('lanePositionOf', () => {
  it('returns 0 for first package in lane', () => {
    const p = pkg({ id: 1, arrivalAtDiverterSec: 10 })
    expect(lanePositionOf(p, [p], 15)).toBe(0)
  })
  it('returns 1 for second package (one arrived earlier)', () => {
    const p1 = pkg({ id: 1, arrivalAtDiverterSec: 10 })
    const p2 = pkg({ id: 2, arrivalAtDiverterSec: 12 })
    expect(lanePositionOf(p2, [p1, p2], 15)).toBe(1)
  })
  it('returns 0 when simTime is before package arrival', () => {
    const p = pkg({ id: 1, arrivalAtDiverterSec: 20 })
    expect(lanePositionOf(p, [p], 15)).toBe(0)
  })
  it('returns 0 for package with null assignedExitId', () => {
    const p = pkg({ id: 1, assignedExitId: null, arrivalAtDiverterSec: 10 })
    const p2 = pkg({ id: 2, assignedExitId: null, arrivalAtDiverterSec: 12 })
    expect(lanePositionOf(p2, [p, p2], 15)).toBe(0)
  })
})
