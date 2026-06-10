/**
 * Mulberry32 seeded PRNG. Returns a function that produces floats in [0, 1).
 * Same seed always yields the same sequence — makes simulations reproducible.
 */
export function createRng(seed: number): () => number {
  let s = seed >>> 0
  return function mulberry32(): number {
    s += 0x6D2B79F5
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 0xFFFFFFFF
  }
}
