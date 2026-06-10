import { describe, it, expect } from 'vitest'
import { createRng } from './seededRng'

describe('createRng', () => {
  it('returns values in [0, 1)', () => {
    const rng = createRng(42)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('produces the same sequence for the same seed', () => {
    const a = createRng(12345)
    const b = createRng(12345)
    for (let i = 0; i < 20; i++) {
      expect(a()).toBe(b())
    }
  })

  it('produces different sequences for different seeds', () => {
    const a = createRng(1)
    const b = createRng(2)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })
})
