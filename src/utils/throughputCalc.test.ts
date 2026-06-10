// src/utils/throughputCalc.test.ts
import { describe, it, expect } from 'vitest'
import {
  theoreticalMaxFeedPPM,
  achievablePPM,
  minSpacingFt,
  gapTimeSec,
} from './throughputCalc'

describe('throughputCalc', () => {
  it('theoreticalMaxFeedPPM: 200 fpm belt, 2 ft product, 0.5 ft gap = 80 PPM', () => {
    expect(theoreticalMaxFeedPPM(200, 2, 0.5)).toBeCloseTo(80, 4)
  })

  it('theoreticalMaxFeedPPM: shorter gap = higher PPM', () => {
    const wide  = theoreticalMaxFeedPPM(200, 2, 1.0)
    const tight = theoreticalMaxFeedPPM(200, 2, 0.25)
    expect(tight).toBeGreaterThan(wide)
  })

  it('achievablePPM: capped by read rate and availability', () => {
    // theoretical = 200/(2+0.5) = 80; × 0.99 × 0.88 ≈ 69.7
    const result = achievablePPM(200, 2, 0.5, 0.99, 0.88)
    expect(result).toBeCloseTo(80 * 0.99 * 0.88, 2)
  })

  it('minSpacingFt: 200 fpm belt, 0.4 sec cycle, 10 ms PLC = belt moves ~1.367 ft', () => {
    const spacing = minSpacingFt(200, 0.4, 10)
    // belt travel in 0.41 sec = 200/60 × 0.41 ≈ 1.367 ft
    expect(spacing).toBeCloseTo(200 / 60 * (0.4 + 0.01), 3)
  })

  it('gapTimeSec: 6 in gap at 200 fpm = 0.15 sec', () => {
    expect(gapTimeSec(6, 200)).toBeCloseTo(0.15, 5)
  })
})
