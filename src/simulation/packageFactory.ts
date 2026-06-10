import type { SimSKU } from './types'

/**
 * Picks a SKU using weighted random selection based on distributionPercent.
 * Weights do not need to sum to 100 — any positive values work.
 */
export function pickSKU(skus: SimSKU[], rng: () => number): SimSKU {
  if (skus.length === 0) throw new Error('No SKUs defined')
  if (skus.length === 1) return skus[0]

  const total = skus.reduce((sum, s) => sum + s.distributionPercent, 0)
  let rand = rng() * total
  for (const sku of skus) {
    rand -= sku.distributionPercent
    if (rand <= 0) return sku
  }
  return skus[skus.length - 1]
}
