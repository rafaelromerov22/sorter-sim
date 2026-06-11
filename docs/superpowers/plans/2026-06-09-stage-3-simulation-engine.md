# Stage 3: Simulation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, seeded simulation engine that runs a sorter conveyor scenario from a `ConveyorLineConfig`, produces per-package outcomes (diverted / jammed / no-read / recirculated), computes KPI summary stats, persists results to Supabase, and surfaces a Run button + results panel in the UI.

**Architecture:** The engine lives entirely in `src/simulation/` and operates in imperial units only — a config adapter converts metric inputs before the run. State is managed via a new `runSimulation` action added to the existing `configStore`. Results are displayed in a new `SimResults` component mounted in the canvas area of `ProjectWorkspace`.

**Tech Stack:** TypeScript (pure functions, no React), Vitest for tests, Zustand for wiring into the UI, Supabase for result persistence, React + Tailwind CSS for the results panel.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/simulation/types.ts` | Create | All simulation-internal types: `SimInput`, `SimExit`, `SimSKU`, `SimPackage`, `JamEvent`, `ExitSimStats`, `SimulationResults` |
| `src/simulation/seededRng.ts` | Create | Mulberry32 seeded PRNG — deterministic reproducibility |
| `src/simulation/seededRng.test.ts` | Create | Tests: determinism, range, seed sensitivity |
| `src/simulation/packageFactory.ts` | Create | Weighted SKU selection from distribution percentages |
| `src/simulation/packageFactory.test.ts` | Create | Tests: single SKU, 50/50 split, 0/100 split |
| `src/simulation/configAdapter.ts` | Create | `toSimInput(line, unitSystem)` — converts `ConveyorLineConfig` to imperial `SimInput` |
| `src/simulation/configAdapter.test.ts` | Create | Tests: metric→imperial conversion, field mapping |
| `src/simulation/engine.ts` | Create | `runSimulation(input)` — main simulation loop |
| `src/simulation/engine.test.ts` | Create | Tests: zero exits, no jams, jam detection, no-read, recirculation, determinism |
| `src/types/index.ts` | Modify | Add `SimulationResults` (storable shape — no package log) |
| `src/store/configStore.ts` | Modify | Add `simResults`, `simLoading`, `runSimulation`, `saveSimResults` |
| `src/components/project/SimResults.tsx` | Create | Results KPI grid + exit table + jam list |
| `src/components/project/ProjectWorkspace.tsx` | Modify | Replace canvas placeholder with `SimResults`; add Run button to header area |

---

## Task 1: Simulation Types

**Files:**
- Create: `src/simulation/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/simulation/types.ts

/** All-imperial input consumed by the engine. Created by configAdapter. */
export interface SimInput {
  beltSpeedFpm: number
  beltLengthFt: number
  minGapIn: number
  availabilityFactor: number   // 0–1
  targetPPM: number
  scanReadRate: number         // 0–1
  plcLatencyMs: number
  recirculationEnabled: boolean
  recirculationDelaySec: number
  noReadExitId: string | null
  randomSeed: number
  exits: SimExit[]
  skus: SimSKU[]
}

export interface SimExit {
  id: string
  index: number
  distanceFromInfeedFt: number
  diverterCycleTimeSec: number
  maxQueueDepth: number
  laneExitSpeedFpm: number
  laneLengthFt: number
}

export interface SimSKU {
  id: string
  name: string
  lengthIn: number
  weightLbs: number
  distributionPercent: number
  assignedExitId: string | null
}

export type PackageOutcome =
  | 'diverted'      // Successfully sorted to an assigned exit lane
  | 'jammed'        // Diverter was still cycling when package arrived
  | 'no_read'       // Scan failed, no no-read exit configured
  | 'recirculated'  // Scan failed, recirculation enabled
  | 'overflow'      // Exit lane queue was at maxQueueDepth

export interface SimPackage {
  id: number
  skuId: string
  skuName: string
  lengthFt: number
  infeedTimeSec: number
  scanSuccess: boolean
  assignedExitId: string | null
  arrivalAtDiverterSec: number | null
  outcome: PackageOutcome
}

export interface JamEvent {
  timeSec: number
  exitId: string
  exitIndex: number
  packageId: number
  gapAvailableSec: number
  gapRequiredSec: number
}

export interface ExitSimStats {
  exitId: string
  exitIndex: number
  packagesProcessed: number
  packagesPerMin: number
  jamCount: number
  queueOverflows: number
}

/** Full in-memory result — includes per-package log. */
export interface SimRunResult {
  runDurationSec: number
  totalPackages: number
  completedPackages: number
  jamCount: number
  noReadCount: number
  recirculationCount: number
  overflowCount: number
  actualPPM: number
  theoreticalMaxPPM: number
  efficiencyPercent: number
  exitStats: ExitSimStats[]
  jamEvents: JamEvent[]
  packages: SimPackage[]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/simulation/types.ts
git commit -m "feat: add simulation engine types"
```

---

## Task 2: Seeded RNG

**Files:**
- Create: `src/simulation/seededRng.ts`
- Create: `src/simulation/seededRng.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/simulation/seededRng.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/simulation/seededRng.test.ts
```

Expected: FAIL — `createRng` not found.

- [ ] **Step 3: Implement the RNG (Mulberry32 algorithm)**

```typescript
// src/simulation/seededRng.ts

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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/simulation/seededRng.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/simulation/seededRng.ts src/simulation/seededRng.test.ts
git commit -m "feat: add Mulberry32 seeded RNG + tests"
```

---

## Task 3: Package Factory (Weighted SKU Selection)

**Files:**
- Create: `src/simulation/packageFactory.ts`
- Create: `src/simulation/packageFactory.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/simulation/packageFactory.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/simulation/packageFactory.test.ts
```

Expected: FAIL — `pickSKU` not found.

- [ ] **Step 3: Implement pickSKU**

```typescript
// src/simulation/packageFactory.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/simulation/packageFactory.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/simulation/packageFactory.ts src/simulation/packageFactory.test.ts
git commit -m "feat: add weighted SKU factory + tests"
```

---

## Task 4: Config Adapter

**Files:**
- Create: `src/simulation/configAdapter.ts`
- Create: `src/simulation/configAdapter.test.ts`

The adapter converts a `ConveyorLineConfig` (which may be in metric or imperial) to an all-imperial `SimInput` consumed by the engine.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/simulation/configAdapter.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/simulation/configAdapter.test.ts
```

Expected: FAIL — `toSimInput` not found.

- [ ] **Step 3: Implement the config adapter**

```typescript
// src/simulation/configAdapter.ts
import type { ConveyorLineConfig, UnitSystem } from '../types'
import type { SimInput, SimExit, SimSKU } from './types'
import { mToFt, mmToIn, mpmToFpm, kgToLbs } from '../utils/unitConverter'

export function toSimInput(line: ConveyorLineConfig, unitSystem: UnitSystem): SimInput {
  const m = unitSystem === 'metric'

  const exits: SimExit[] = line.exits.map(e => ({
    id: e.id,
    index: e.index,
    distanceFromInfeedFt: m ? mToFt(e.distanceFromInfeed) : e.distanceFromInfeed,
    diverterCycleTimeSec: e.diverterCycleTime,
    maxQueueDepth: e.maxQueueDepth,
    laneExitSpeedFpm: m ? mpmToFpm(e.exitSpeed) : e.exitSpeed,
    laneLengthFt: m ? mToFt(e.laneLength) : e.laneLength,
  }))

  const skus: SimSKU[] = line.skus.map(sk => ({
    id: sk.id,
    name: sk.name,
    lengthIn: m ? mmToIn(sk.length) : sk.length,
    weightLbs: m ? kgToLbs(sk.weight) : sk.weight,
    distributionPercent: sk.distributionPercent,
    assignedExitId: sk.assignedExitId,
  }))

  return {
    beltSpeedFpm: m ? mpmToFpm(line.conveyor.speed) : line.conveyor.speed,
    beltLengthFt: m ? mToFt(line.conveyor.length) : line.conveyor.length,
    minGapIn: m ? mmToIn(line.conveyor.minGapDistance) : line.conveyor.minGapDistance,
    availabilityFactor: line.conveyor.availabilityFactor,
    targetPPM: line.feed.targetPPM,
    scanReadRate: line.feed.scanReadRate,
    plcLatencyMs: line.feed.plcLatencyMs,
    recirculationEnabled: line.recirculationEnabled,
    recirculationDelaySec: line.recirculationDelaySec,
    noReadExitId: line.noReadExitId,
    randomSeed: line.randomSeed,
    exits,
    skus,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/simulation/configAdapter.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/simulation/configAdapter.ts src/simulation/configAdapter.test.ts
git commit -m "feat: add config adapter (ConveyorLineConfig → SimInput) + tests"
```

---

## Task 5: Simulation Engine

**Files:**
- Create: `src/simulation/engine.ts`
- Create: `src/simulation/engine.test.ts`

The engine loops through packages at `targetPPM` rate for up to `MAX_PACKAGES` (5 000) or `RUN_DURATION_SEC` (300 s), whichever comes first. Per-package:
1. Skip slot if availability factor roll fails.
2. Pick SKU (weighted random).
3. Roll scan success.
4. Assign exit (from SKU assignment, no-read exit, recirculation, or null).
5. Compute arrival time at diverter.
6. Check diverter availability → `jammed` or proceed.
7. Check exit lane queue → `overflow` or `diverted`.
8. Update diverter available-at and lane queue.

Exit lane queue tracking: for each exit, maintain a sorted array of departure times. When a package is diverted, remove stale entries (departure < arrival), check length against `maxQueueDepth`, then push `max(lastDeparture, arrival) + laneClearTimeSec`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/simulation/engine.test.ts
import { describe, it, expect } from 'vitest'
import { runSimulation } from './engine'
import type { SimInput, SimExit, SimSKU } from './types'

function baseExit(overrides: Partial<SimExit> = {}): SimExit {
  return {
    id: 'exit-1', index: 0,
    distanceFromInfeedFt: 50,
    diverterCycleTimeSec: 0.45,
    maxQueueDepth: 10,
    laneExitSpeedFpm: 150,
    laneLengthFt: 10,
    ...overrides,
  }
}

function baseSKU(overrides: Partial<SimSKU> = {}): SimSKU {
  return {
    id: 'sku-1', name: 'Box A',
    lengthIn: 12, weightLbs: 5,
    distributionPercent: 100,
    assignedExitId: 'exit-1',
    ...overrides,
  }
}

function baseInput(overrides: Partial<SimInput> = {}): SimInput {
  return {
    beltSpeedFpm: 200,
    beltLengthFt: 100,
    minGapIn: 6,
    availabilityFactor: 1.0,
    targetPPM: 20,
    scanReadRate: 1.0,
    plcLatencyMs: 0,
    recirculationEnabled: false,
    recirculationDelaySec: 30,
    noReadExitId: null,
    randomSeed: 42,
    exits: [baseExit()],
    skus: [baseSKU()],
    ...overrides,
  }
}

describe('runSimulation', () => {
  it('runs with no SKUs and no exits — returns zero completedPackages', () => {
    const result = runSimulation(baseInput({ exits: [], skus: [] }))
    expect(result.completedPackages).toBe(0)
    expect(result.totalPackages).toBeGreaterThan(0)
  })

  it('all packages diverted when PPM is well below capacity', () => {
    // 20 PPM, diverter cycle 0.45 s → gap between packages = 3 s >> 0.45 s, no jams
    const result = runSimulation(baseInput({ targetPPM: 20 }))
    expect(result.jamCount).toBe(0)
    expect(result.completedPackages).toBe(result.totalPackages)
    expect(result.actualPPM).toBeCloseTo(20, 0)
  })

  it('detects jams when PPM exceeds diverter capacity', () => {
    // diverterCycleTime = 0.45 s → max 60/0.45 ≈ 133 PPM at this exit
    // We request 150 PPM → many jams
    const result = runSimulation(baseInput({ targetPPM: 150 }))
    expect(result.jamCount).toBeGreaterThan(0)
    expect(result.actualPPM).toBeLessThan(150)
  })

  it('all packages are no-read when scanReadRate is 0 and no handler', () => {
    const result = runSimulation(baseInput({ scanReadRate: 0, noReadExitId: null, recirculationEnabled: false }))
    expect(result.noReadCount).toBe(result.totalPackages)
    expect(result.completedPackages).toBe(0)
  })

  it('routes no-reads to the no-read exit when configured', () => {
    const noReadExit = baseExit({ id: 'no-read-exit', index: 1, distanceFromInfeedFt: 80 })
    const result = runSimulation(baseInput({
      scanReadRate: 0,
      noReadExitId: 'no-read-exit',
      exits: [baseExit(), noReadExit],
    }))
    expect(result.completedPackages).toBe(result.totalPackages)
    const noReadExitStats = result.exitStats.find(e => e.exitId === 'no-read-exit')
    expect(noReadExitStats?.packagesProcessed).toBeGreaterThan(0)
  })

  it('recirculates no-reads when recirculationEnabled and no noReadExit', () => {
    const result = runSimulation(baseInput({
      scanReadRate: 0,
      recirculationEnabled: true,
      noReadExitId: null,
    }))
    expect(result.recirculationCount).toBe(result.totalPackages)
    expect(result.completedPackages).toBe(0)
  })

  it('is deterministic — same seed, same result', () => {
    const a = runSimulation(baseInput({ targetPPM: 80, scanReadRate: 0.95, randomSeed: 7 }))
    const b = runSimulation(baseInput({ targetPPM: 80, scanReadRate: 0.95, randomSeed: 7 }))
    expect(a.completedPackages).toBe(b.completedPackages)
    expect(a.jamCount).toBe(b.jamCount)
    expect(a.noReadCount).toBe(b.noReadCount)
  })

  it('different seeds produce different results', () => {
    const a = runSimulation(baseInput({ targetPPM: 80, scanReadRate: 0.9, randomSeed: 1 }))
    const b = runSimulation(baseInput({ targetPPM: 80, scanReadRate: 0.9, randomSeed: 999 }))
    // Very unlikely to match exactly
    expect(a.noReadCount !== b.noReadCount || a.jamCount !== b.jamCount).toBe(true)
  })

  it('computes efficiencyPercent as actualPPM / theoreticalMaxPPM * 100', () => {
    const result = runSimulation(baseInput({ targetPPM: 20 }))
    const expected = (result.actualPPM / result.theoreticalMaxPPM) * 100
    expect(result.efficiencyPercent).toBeCloseTo(expected, 1)
  })

  it('respects availability factor — low availability reduces completedPackages', () => {
    const full  = runSimulation(baseInput({ targetPPM: 30, availabilityFactor: 1.0, randomSeed: 1 }))
    const half  = runSimulation(baseInput({ targetPPM: 30, availabilityFactor: 0.5, randomSeed: 1 }))
    expect(half.completedPackages).toBeLessThan(full.completedPackages)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/simulation/engine.test.ts
```

Expected: FAIL — `runSimulation` not found.

- [ ] **Step 3: Implement the engine**

```typescript
// src/simulation/engine.ts
import type { SimInput, SimRunResult, SimPackage, JamEvent, ExitSimStats, PackageOutcome } from './types'
import { createRng } from './seededRng'
import { pickSKU } from './packageFactory'
import { theoreticalMaxFeedPPM } from '../utils/throughputCalc'

const MAX_PACKAGES = 5_000
const RUN_DURATION_SEC = 300

export function runSimulation(input: SimInput): SimRunResult {
  const { beltSpeedFpm, minGapIn, targetPPM, scanReadRate, plcLatencyMs, availabilityFactor } = input
  const rng = createRng(input.randomSeed)
  const intervalSec = 60 / targetPPM

  // Theoretical max uses the longest SKU
  const longestSkuLengthFt = input.skus.length > 0
    ? Math.max(...input.skus.map(s => s.lengthIn)) / 12
    : 1
  const theoreticalMax = theoreticalMaxFeedPPM(beltSpeedFpm, longestSkuLengthFt, minGapIn / 12)

  // Per-exit state
  const diverterAvailableAt: Record<string, number> = {}
  const laneQueue: Record<string, number[]> = {}       // sorted departure times
  const exitProcessed: Record<string, number> = {}
  const exitJamCount: Record<string, number> = {}
  input.exits.forEach(e => {
    diverterAvailableAt[e.id] = 0
    laneQueue[e.id] = []
    exitProcessed[e.id] = 0
    exitJamCount[e.id] = 0
  })

  const packages: SimPackage[] = []
  const jamEvents: JamEvent[] = []
  let noReadCount = 0
  let recirculationCount = 0
  let completedCount = 0
  let jamCount = 0
  let overflowCount = 0

  for (let i = 0; i < MAX_PACKAGES; i++) {
    const infeedTimeSec = i * intervalSec
    if (infeedTimeSec > RUN_DURATION_SEC) break

    // Availability: skip slot if machine is down
    if (rng() > availabilityFactor) continue

    const hasSKUs = input.skus.length > 0
    const sku = hasSKUs ? pickSKU(input.skus, rng) : null
    const scanSuccess = rng() < scanReadRate

    // Assign exit
    let assignedExitId: string | null = null
    if (scanSuccess && sku) {
      assignedExitId = sku.assignedExitId
      // Unassigned SKU falls through as no-read
    }
    if (!scanSuccess || !assignedExitId) {
      if (!scanSuccess) noReadCount++
      if (input.noReadExitId) {
        assignedExitId = input.noReadExitId
      } else if (input.recirculationEnabled) {
        recirculationCount++
        // Recirculated packages are not re-injected in this model; just counted
        packages.push({
          id: i, skuId: sku?.id ?? '', skuName: sku?.name ?? 'Unknown',
          lengthFt: (sku?.lengthIn ?? 12) / 12,
          infeedTimeSec, scanSuccess, assignedExitId: null,
          arrivalAtDiverterSec: null, outcome: 'recirculated',
        })
        continue
      }
    }

    // Determine outcome
    let outcome: PackageOutcome = 'no_read'
    let arrivalAtDiverterSec: number | null = null

    if (!assignedExitId) {
      outcome = 'no_read'
    } else {
      const exit = input.exits.find(e => e.id === assignedExitId)
      if (!exit) {
        outcome = 'no_read'
      } else {
        const beltSpeedFps = beltSpeedFpm / 60
        const travelSec = exit.distanceFromInfeedFt / beltSpeedFps
        arrivalAtDiverterSec = infeedTimeSec + travelSec + plcLatencyMs / 1000

        // Check diverter
        if (arrivalAtDiverterSec < diverterAvailableAt[exit.id]) {
          outcome = 'jammed'
          jamCount++
          exitJamCount[exit.id]++
          if (jamEvents.length < 100) {
            const gapAvail = arrivalAtDiverterSec -
              (diverterAvailableAt[exit.id] - exit.diverterCycleTimeSec)
            jamEvents.push({
              timeSec: arrivalAtDiverterSec,
              exitId: exit.id,
              exitIndex: exit.index,
              packageId: i,
              gapAvailableSec: Math.max(0, gapAvail),
              gapRequiredSec: exit.diverterCycleTimeSec,
            })
          }
        } else {
          // Check lane queue
          const queue = laneQueue[exit.id]
          // Remove already-departed entries
          const pruned = queue.filter(t => t > arrivalAtDiverterSec)
          laneQueue[exit.id] = pruned

          if (pruned.length >= exit.maxQueueDepth) {
            outcome = 'overflow'
            overflowCount++
          } else {
            outcome = 'diverted'
            completedCount++
            exitProcessed[exit.id]++
            diverterAvailableAt[exit.id] = arrivalAtDiverterSec + exit.diverterCycleTimeSec

            // Schedule lane departure
            const packageLengthFt = (sku?.lengthIn ?? 12) / 12
            const laneClearSec = packageLengthFt / (exit.laneExitSpeedFpm / 60)
            const lastDep = pruned.length > 0 ? Math.max(...pruned) : arrivalAtDiverterSec
            laneQueue[exit.id].push(Math.max(lastDep, arrivalAtDiverterSec) + laneClearSec)
          }
        }
      }
    }

    packages.push({
      id: i,
      skuId: sku?.id ?? '',
      skuName: sku?.name ?? 'Unknown',
      lengthFt: (sku?.lengthIn ?? 12) / 12,
      infeedTimeSec,
      scanSuccess,
      assignedExitId,
      arrivalAtDiverterSec,
      outcome,
    })
  }

  const actualRunSec = packages.length > 0
    ? packages[packages.length - 1].infeedTimeSec + intervalSec
    : RUN_DURATION_SEC
  const runMinutes = actualRunSec / 60
  const actualPPM = runMinutes > 0 ? completedCount / runMinutes : 0
  const efficiencyPercent = theoreticalMax > 0 ? (actualPPM / theoreticalMax) * 100 : 0

  const exitStats: ExitSimStats[] = input.exits.map(e => ({
    exitId: e.id,
    exitIndex: e.index,
    packagesProcessed: exitProcessed[e.id],
    packagesPerMin: runMinutes > 0 ? exitProcessed[e.id] / runMinutes : 0,
    jamCount: exitJamCount[e.id],
    queueOverflows: 0,
  }))

  return {
    runDurationSec: actualRunSec,
    totalPackages: packages.length,
    completedPackages: completedCount,
    jamCount,
    noReadCount,
    recirculationCount,
    overflowCount,
    actualPPM,
    theoreticalMaxPPM: theoreticalMax,
    efficiencyPercent,
    exitStats,
    jamEvents,
    packages,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/simulation/engine.test.ts
```

Expected: PASS (9 tests).

- [ ] **Step 5: Run all tests to confirm no regressions**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/simulation/engine.ts src/simulation/engine.test.ts
git commit -m "feat: add simulation engine with jam/no-read/recirculation logic + tests"
```

---

## Task 6: Add SimulationResults to Types + Wire into configStore

**Files:**
- Modify: `src/types/index.ts` — add storable `SimulationResults` type
- Modify: `src/store/configStore.ts` — add `simResults`, `simLoading`, `runSimulation`, `saveSimResults`

The storable `SimulationResults` (saved to `project_versions.results_json`) is the summary without the full package log. The full `SimRunResult` from the engine stays in-memory only.

- [ ] **Step 1: Add `SimulationResults` to `src/types/index.ts`**

Add after the `ValidationResult` interface at the bottom of the file:

```typescript
// ── Simulation results (stored in project_versions.results_json) ─────────────
export interface SimulationResults {
  runDurationSec: number
  totalPackages: number
  completedPackages: number
  jamCount: number
  noReadCount: number
  recirculationCount: number
  overflowCount: number
  actualPPM: number
  theoreticalMaxPPM: number
  efficiencyPercent: number
  exitStats: Array<{
    exitId: string
    exitIndex: number
    packagesProcessed: number
    packagesPerMin: number
    jamCount: number
  }>
  jamEvents: Array<{
    timeSec: number
    exitId: string
    exitIndex: number
    packageId: number
    gapAvailableSec: number
    gapRequiredSec: number
  }>
}
```

- [ ] **Step 2: Add simulation state and actions to `src/store/configStore.ts`**

**2a.** Add imports at the top of the file (after existing imports):

```typescript
import { runSimulation } from '../simulation/engine'
import { toSimInput } from '../simulation/configAdapter'
import type { SimulationResults } from '../types'
import type { SimRunResult } from '../simulation/types'
```

**2b.** Add to the `ConfigStore` interface (after `restoreVersion`):

```typescript
  // Simulation
  simResults: SimulationResults | null
  simFullResult: SimRunResult | null   // in-memory only, not persisted
  simLoading: boolean
  runSimulation: () => Promise<void>
  saveSimResults: () => Promise<void>
```

**2c.** Add to `INITIAL_STATE`:

```typescript
  simResults: null,
  simFullResult: null,
  simLoading: false,
```

**2d.** Add the implementations inside `create<ConfigStore>((set, get) => ({ ... }))`, after `restoreVersion`:

```typescript
  runSimulation: async () => {
    const { lines, activeLineId, unitSystem } = get()
    const line = lines.find(l => l.id === activeLineId)
    if (!line) return
    set({ simLoading: true, simResults: null, simFullResult: null })
    try {
      const input = toSimInput(line, unitSystem)
      const full = runSimulation(input)
      // Strip package log for the storable summary
      const summary: SimulationResults = {
        runDurationSec:     full.runDurationSec,
        totalPackages:      full.totalPackages,
        completedPackages:  full.completedPackages,
        jamCount:           full.jamCount,
        noReadCount:        full.noReadCount,
        recirculationCount: full.recirculationCount,
        overflowCount:      full.overflowCount,
        actualPPM:          full.actualPPM,
        theoreticalMaxPPM:  full.theoreticalMaxPPM,
        efficiencyPercent:  full.efficiencyPercent,
        exitStats:          full.exitStats.map(e => ({
          exitId:             e.exitId,
          exitIndex:          e.exitIndex,
          packagesProcessed:  e.packagesProcessed,
          packagesPerMin:     e.packagesPerMin,
          jamCount:           e.jamCount,
        })),
        jamEvents: full.jamEvents.slice(0, 20),
      }
      set({ simLoading: false, simResults: summary, simFullResult: full })
    } catch (e) {
      set({ simLoading: false, error: e instanceof Error ? e.message : 'Simulation failed' })
    }
  },

  saveSimResults: async () => {
    const { projectId, simResults } = get()
    if (!projectId || !simResults) return
    try {
      // Update the most recent version's results_json
      const { data: latest } = await supabase
        .from('project_versions')
        .select('id')
        .eq('project_id', projectId)
        .order('version_num', { ascending: false })
        .limit(1)
        .single()
      if (!latest) return
      await supabase
        .from('project_versions')
        .update({ results_json: simResults })
        .eq('id', latest.id)
    } catch {
      // Non-fatal — results still displayed in UI
    }
  },
```

**2e.** Add `unitSystem` to the `ConfigStore` interface (it already exists on INITIAL_STATE but is typed as part of the store — confirm it's in the interface). The interface already has `unitSystem: UnitSystem`. No change needed.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/store/configStore.ts
git commit -m "feat: add SimulationResults type and runSimulation/saveSimResults to configStore"
```

---

## Task 7: SimResults Display Component

**Files:**
- Create: `src/components/project/SimResults.tsx`

This component receives a `SimulationResults` and renders:
- KPI row: Actual PPM / Theoretical Max PPM / Efficiency % / Total Packages / Jams / No-Reads
- Exit table: one row per exit showing packages processed, PPM, jam count
- Jam list (first 10): time, exit index, gap available vs required

- [ ] **Step 1: Create the component**

```tsx
// src/components/project/SimResults.tsx
import type { SimulationResults } from '../../types'

interface Props {
  results: SimulationResults
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-gray-200 bg-white px-4 py-3 text-center">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="mt-1 text-2xl font-semibold tabular-nums text-gray-800">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

export function SimResults({ results }: Props) {
  const effColor =
    results.efficiencyPercent >= 80 ? 'text-green-600' :
    results.efficiencyPercent >= 50 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <Kpi label="Actual PPM"    value={results.actualPPM.toFixed(1)} />
        <Kpi label="Max PPM"       value={results.theoreticalMaxPPM.toFixed(1)} />
        <Kpi
          label="Efficiency"
          value={`${results.efficiencyPercent.toFixed(1)}%`}
          sub={results.efficiencyPercent >= 80 ? 'Good' : results.efficiencyPercent >= 50 ? 'Fair' : 'Poor'}
        />
        <Kpi label="Packages"   value={results.totalPackages.toString()} />
        <Kpi label="Jams"       value={results.jamCount.toString()} />
        <Kpi label="No-Reads"   value={results.noReadCount.toString()} />
      </div>

      {/* Exit table */}
      {results.exitStats.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-600">Exit Performance</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-400">
                <th className="pb-1 pr-4">Exit</th>
                <th className="pb-1 pr-4">Packages</th>
                <th className="pb-1 pr-4">PPM</th>
                <th className="pb-1">Jams</th>
              </tr>
            </thead>
            <tbody>
              {results.exitStats.map(e => (
                <tr key={e.exitId} className="border-b border-gray-100">
                  <td className="py-1 pr-4 font-medium">Exit {e.exitIndex + 1}</td>
                  <td className="py-1 pr-4 tabular-nums">{e.packagesProcessed}</td>
                  <td className="py-1 pr-4 tabular-nums">{e.packagesPerMin.toFixed(1)}</td>
                  <td className={`py-1 tabular-nums ${e.jamCount > 0 ? 'text-red-600' : ''}`}>
                    {e.jamCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Jam events */}
      {results.jamEvents.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-600">
            Jam Events ({results.jamEvents.length} shown)
          </h3>
          <div className="space-y-1">
            {results.jamEvents.slice(0, 10).map((j, i) => (
              <div key={i} className="rounded bg-red-50 px-3 py-1.5 text-xs text-red-700">
                t={j.timeSec.toFixed(1)}s · Exit {j.exitIndex + 1} ·{' '}
                gap {j.gapAvailableSec.toFixed(3)}s available, {j.gapRequiredSec.toFixed(3)}s needed
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run metadata */}
      <p className="text-xs text-gray-300">
        Simulated {results.totalPackages} packages over {results.runDurationSec.toFixed(0)}s
        · {results.recirculationCount} recirculated · {results.overflowCount} overflow
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/project/SimResults.tsx
git commit -m "feat: add SimResults display component (KPIs, exit table, jam log)"
```

---

## Task 8: Wire Run Button into ProjectWorkspace

**Files:**
- Modify: `src/components/project/ProjectWorkspace.tsx`

Replace the "Simulation Canvas — Coming in Stage 3" placeholder with either:
- `SimResults` when results exist
- The placeholder when `simResults` is null and `simLoading` is false
- A loading spinner when `simLoading` is true

Add a **Run Simulation** button to the line tabs area (right side of the `LinesTabs` row).

- [ ] **Step 1: Read the current ProjectWorkspace**

The file is at `src/components/project/ProjectWorkspace.tsx`. It currently has:

```tsx
{/* Canvas area — Stage 3 placeholder */}
<div className="flex flex-1 items-center justify-center bg-gray-100">
  <div className="text-center">
    <div className="text-4xl text-gray-300">⚙</div>
    <p className="mt-2 text-sm font-medium text-gray-400">Simulation Canvas</p>
    <p className="text-xs text-gray-300">Coming in Stage 3</p>
  </div>
</div>
```

Replace the entire file with:

```tsx
// src/components/project/ProjectWorkspace.tsx
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { Header } from '../shared/Header'
import { LinesTabs } from './LinesTabs'
import { ConfigSidebar } from '../config/ConfigSidebar'
import { VersionHistory } from './VersionHistory'
import { SimResults } from './SimResults'
import { useConfigStore } from '../../store/configStore'
import { useProjectStore } from '../../store/projectStore'

export function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>()

  const { loadConfig, configLoading, simResults, simLoading, runSimulation } =
    useConfigStore(useShallow(s => ({
      loadConfig:   s.loadConfig,
      configLoading: s.configLoading,
      simResults:   s.simResults,
      simLoading:   s.simLoading,
      runSimulation: s.runSimulation,
    })))

  const projects    = useProjectStore(s => s.projects)
  const unitSystem  = useProjectStore(s => s.unitSystem)
  const project     = projects.find(p => p.id === id)

  useEffect(() => {
    if (!id) return
    loadConfig(id, project?.name ?? 'Untitled Project', project?.unit_system ?? unitSystem)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (configLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-gray-400">Loading project…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Config sidebar */}
        <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white">
          <ConfigSidebar />
        </aside>

        {/* Centre */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Line tabs + Run button */}
          <div className="flex items-center border-b border-gray-200 bg-white">
            <div className="flex-1 overflow-hidden">
              <LinesTabs />
            </div>
            <div className="shrink-0 px-3">
              <button
                onClick={() => runSimulation()}
                disabled={simLoading}
                className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {simLoading ? 'Running…' : '▶ Run'}
              </button>
            </div>
          </div>

          {/* Canvas / results area */}
          <div className="flex flex-1 overflow-hidden bg-gray-100">
            {simLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-gray-400">Running simulation…</p>
              </div>
            ) : simResults ? (
              <div className="flex-1 overflow-y-auto">
                <SimResults results={simResults} />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl text-gray-300">▶</div>
                  <p className="mt-2 text-sm font-medium text-gray-400">Press Run to simulate</p>
                  <p className="text-xs text-gray-300">Configure the belt, exits, and products first</p>
                </div>
              </div>
            )}
          </div>

          {/* KPI strip — Stage 4 placeholder */}
          <div className="flex h-16 items-center justify-center border-t border-gray-200 bg-white">
            <p className="text-xs text-gray-300">KPI Dashboard — Stage 4</p>
          </div>
        </div>

        {/* Right: Version history */}
        <VersionHistory />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit and push**

```bash
git add src/components/project/ProjectWorkspace.tsx
git commit -m "feat: wire Run button and SimResults into ProjectWorkspace"
git push
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| Discrete-event simulation loop | Task 5 (engine.ts) |
| Diverter logic (scan → assign → trigger at right moment) | Task 5 |
| Throughput / jam / no-read event tracking | Tasks 5 + 6 |
| Results stored to `results_json` | Task 6 (`saveSimResults`) |
| Run button in UI | Task 8 |
| Results display panel | Task 7 + 8 |
| Seeded / deterministic | Task 2 (RNG) + engine test |
| Metric ↔ imperial correctness | Task 4 (configAdapter) |

### Placeholder scan
No TBDs, no "add error handling" stubs — every step has complete code.

### Type consistency
- `SimRunResult` (in-memory, from engine) vs `SimulationResults` (storable, in `src/types/index.ts`) — deliberately different. The store converts between them in `runSimulation`.
- `pickSKU` accepts `SimSKU[]` and `() => number` — matches usage in engine.
- `toSimInput` returns `SimInput` — matches engine parameter type.
- `runSimulation(input: SimInput): SimRunResult` — engine signature consistent with store call.
