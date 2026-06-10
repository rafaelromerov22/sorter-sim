import { describe, it, expect } from 'vitest'
import { pickSKU } from './packageFactory'
import { createRng } from './seededRng'
import type { SimSKU } from './types'

function makeSKU(id: string, dist: number): SimSKU {
  return { id, name: id, lengthIn: 12, weightLbs: 5, distributionPercent: dist, assignedExitId: null }
}

describe('pickSKU', () => {
  it('returns the only SKU when there is one', () => {
    const rng = createRng(1)
    const sku = makeSKU('A', 100)
    for (let i = 0; i < 20; i++) {
      expect(pickSKU([sku], rng).id).toBe('A')
    }
  })

  it('picks 0/100 split correctly — always returns second SKU', () => {
    const rng = createRng(1)
    const skus = [makeSKU('A', 0), makeSKU('B', 100)]
    for (let i = 0; i < 20; i++) {
      expect(pickSKU(skus, rng).id).toBe('B')
    }
  })

  it('50/50 split produces roughly equal counts over many draws', () => {
    const rng = createRng(42)
    const skus = [makeSKU('A', 50), makeSKU('B', 50)]
    const counts: Record<string, number> = { A: 0, B: 0 }
    for (let i = 0; i < 1000; i++) {
      counts[pickSKU(skus, rng).id]++
    }
    expect(counts.A).toBeGreaterThan(400)
    expect(counts.B).toBeGreaterThan(400)
  })

  it('throws when SKU list is empty', () => {
    const rng = createRng(1)
    expect(() => pickSKU([], rng)).toThrow('No SKUs defined')
  })
})
