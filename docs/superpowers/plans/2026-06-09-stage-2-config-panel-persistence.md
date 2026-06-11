# Stage 2: Full Configuration Panel + Data Persistence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all config input panels (Conveyor, Exits, Products, Feed) with live validation, multi-line tabs, and Supabase version history save/load.

**Architecture:** All configuration lives in a new `configStore` (Zustand), stored in the active unit system. Numeric values convert in-place when the user switches unit systems. Config persists as a JSONB blob per version in the `project_versions` Supabase table. Layout: 320 px left sidebar (tabbed config panels) + right area (canvas + KPI placeholders for Stages 3–4).

**Tech Stack:** React 18 + TypeScript + Tailwind CSS v4, Zustand, Supabase (Postgres + RLS), Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/types/index.ts` | Modify | Add all Stage 2 config interfaces |
| `src/utils/unitConverter.ts` | Create | ft↔m, in↔mm, lbs↔kg + `convertLineConfig` |
| `src/utils/throughputCalc.ts` | Create | Pure throughput/spacing formulas |
| `src/constants/diverterPresets.ts` | Create | Manufacturer presets for all 5 diverter types |
| `src/utils/validation.ts` | Create | Returns `ValidationResult[]` for a line config |
| `src/store/configStore.ts` | Create | Zustand: config state, line CRUD, version CRUD |
| `src/components/shared/InputField.tsx` | Create | Labeled input with inline unit badge + error |
| `src/components/shared/SelectField.tsx` | Create | Labeled `<select>` |
| `src/components/shared/ValidationBadge.tsx` | Create | Red/amber/blue badge |
| `src/components/config/ConveyorConfigPanel.tsx` | Create | Belt length/width/speed/gap/availability |
| `src/components/config/ExitConfigPanel.tsx` | Create | Exit list + per-exit diverter timing |
| `src/components/config/ProductConfigPanel.tsx` | Create | SKU list + per-SKU fields |
| `src/components/config/FeedConfigPanel.tsx` | Create | Feed mode, PPM, scan rate, PLC latency |
| `src/components/config/ConfigSidebar.tsx` | Create | Tabbed container for all panels + Save button |
| `src/components/project/LinesTabs.tsx` | Create | Tab bar: add/rename/duplicate/delete lines |
| `src/components/project/VersionHistory.tsx` | Create | Collapsible sidebar: list/save/restore versions |
| `src/components/project/ProjectWorkspace.tsx` | Modify | Replace placeholder with full layout |
| `src/utils/unitConverter.test.ts` | Create | Conversion functions + round-trips |
| `src/utils/throughputCalc.test.ts` | Create | Throughput formulas with known values |
| `src/utils/validation.test.ts` | Create | Validation rules at boundary values |
| `src/store/configStore.test.ts` | Create | Sync state transitions |

---

### Task 1: Expand TypeScript types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Replace `src/types/index.ts` with the expanded version**

```typescript
// src/types/index.ts

// ── Unit system ──────────────────────────────────────────────────────────────
export type UnitSystem = 'imperial' | 'metric'

// ── Supabase table shapes ────────────────────────────────────────────────────
export interface Project {
  id: string
  owner_id: string
  name: string
  description: string | null
  unit_system: UnitSystem
  created_at: string
  updated_at: string
}

export interface AuthUser {
  id: string
  email: string | undefined
}

// ── Diverter ─────────────────────────────────────────────────────────────────
export type DiverterType =
  | 'sliding_shoe'
  | 'pop_up_roller'
  | 'arm_pusher'
  | 'mdr_module'
  | 'powered_roller'

export interface DiverterPreset {
  type: DiverterType
  label: string
  cycleTimeRange: [number, number]   // seconds [min, max]
  extendTimeRange: [number, number]
  retractTimeRange: [number, number]
  minProductLength: number           // inches (imperial canonical)
  maxProductWeight: number           // lbs (imperial canonical)
  maxCyclesPerHour: number
  maxBeltSpeed: number               // ft/min (imperial canonical)
  notes: string
}

// ── Config building blocks ───────────────────────────────────────────────────
export type ExitSide = 'left' | 'right'
export type DivertAngle = 30 | 45 | 90
export type FeedMode = 'horizontal' | 'vertical' | 'random'
export type PackagingType = 'rigid_carton' | 'poly_bag' | 'tote' | 'loose_item'
export type ProductOrientation = 'long_axis_parallel' | 'long_axis_perpendicular'
export type ValidationSeverity = 'critical' | 'warning' | 'info'

export interface ConveyorConfig {
  length: number             // ft | m
  width: number              // ft | m
  speed: number              // ft/min | m/min
  minGapDistance: number     // in | mm  (minGapTime is derived in UI)
  availabilityFactor: number // 0.0–1.0
  encoderResolution: number  // pulses per ft | m
}

export interface ExitConfig {
  id: string
  index: number
  side: ExitSide
  distanceFromInfeed: number  // ft | m
  laneWidth: number           // ft | m
  laneLength: number          // ft | m
  exitSpeed: number           // ft/min | m/min
  maxQueueDepth: number       // products
  angle: DivertAngle
  diverterType: DiverterType
  diverterCycleTime: number   // seconds
  diverterExtendTime: number  // seconds
  diverterRetractTime: number // seconds
  sensorOffset: number        // ft | m (distance upstream from divert centre)
  priority: number
}

export interface ProductSKU {
  id: string
  name: string
  length: number              // in | mm
  width: number               // in | mm
  height: number              // in | mm
  weight: number              // lbs | kg
  orientation: ProductOrientation
  packagingType: PackagingType
  cogHeight: number           // in | mm (centre-of-gravity height)
  distributionPercent: number // all SKUs must sum to 100
  assignedExitId: string | null
  color: string               // hex  e.g. '#3b82f6'
}

export interface FeedConfig {
  mode: FeedMode
  targetPPM: number
  mixedDimensions: boolean
  singulated: boolean
  metered: boolean
  scanReadRate: number   // 0.0–1.0
  plcLatencyMs: number
}

export interface ConveyorLineConfig {
  id: string
  name: string
  conveyor: ConveyorConfig
  exits: ExitConfig[]
  feed: FeedConfig
  skus: ProductSKU[]
  recirculationEnabled: boolean
  recirculationDelaySec: number
  noReadExitId: string | null
  randomSeed: number
}

export interface ProjectConfig {
  projectId: string
  projectName: string
  unitSystem: UnitSystem
  lines: ConveyorLineConfig[]
}

// ── Supabase project_versions row ────────────────────────────────────────────
export interface ProjectVersion {
  id: string
  project_id: string
  version_num: number
  label: string | null
  config_json: ProjectConfig
  results_json: unknown | null
  created_at: string
  created_by: string
}

// ── Validation ───────────────────────────────────────────────────────────────
export interface ValidationResult {
  severity: ValidationSeverity
  field: string   // dot-notation path e.g. 'feed.targetPPM' or 'exits[0].diverterType'
  message: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add Stage 2 config type definitions"
```

---

### Task 2: Unit converter + tests

**Files:**
- Create: `src/utils/unitConverter.ts`
- Create: `src/utils/unitConverter.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/utils/unitConverter.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/utils/unitConverter.ts`**

```typescript
// src/utils/unitConverter.ts
import type { ConveyorLineConfig, ExitConfig, ProductSKU, UnitSystem } from '../types'

// ── Primitive conversions ────────────────────────────────────────────────────
export const ftToM   = (v: number) => v * 0.3048
export const mToFt   = (v: number) => v / 0.3048
export const inToMm  = (v: number) => v * 25.4
export const mmToIn  = (v: number) => v / 25.4
export const lbsToKg = (v: number) => v * 0.453592
export const kgToLbs = (v: number) => v / 0.453592
export const fpmToMpm = (v: number) => v * 0.3048
export const mpmToFpm = (v: number) => v / 0.3048

// ── Dimension types ──────────────────────────────────────────────────────────
export type Dimension = 'length' | 'speed' | 'weight' | 'smallLength'

export function toMetric(v: number, dim: Dimension): number {
  switch (dim) {
    case 'length':      return ftToM(v)
    case 'speed':       return fpmToMpm(v)
    case 'weight':      return lbsToKg(v)
    case 'smallLength': return inToMm(v)
  }
}

export function toImperial(v: number, dim: Dimension): number {
  switch (dim) {
    case 'length':      return mToFt(v)
    case 'speed':       return mpmToFpm(v)
    case 'weight':      return kgToLbs(v)
    case 'smallLength': return mmToIn(v)
  }
}

export function unitLabel(dim: Dimension, system: UnitSystem): string {
  const map: Record<Dimension, { imperial: string; metric: string }> = {
    length:      { imperial: 'ft',     metric: 'm'     },
    speed:       { imperial: 'ft/min', metric: 'm/min' },
    weight:      { imperial: 'lbs',    metric: 'kg'    },
    smallLength: { imperial: 'in',     metric: 'mm'    },
  }
  return map[dim][system]
}

// ── Full line conversion ─────────────────────────────────────────────────────
export function convertLineConfig(
  line: ConveyorLineConfig,
  from: UnitSystem,
  to: UnitSystem,
): ConveyorLineConfig {
  if (from === to) return line
  const cv = to === 'metric' ? toMetric : toImperial
  return {
    ...line,
    conveyor: {
      ...line.conveyor,
      length:         cv(line.conveyor.length,         'length'),
      width:          cv(line.conveyor.width,          'length'),
      speed:          cv(line.conveyor.speed,          'speed'),
      minGapDistance: cv(line.conveyor.minGapDistance, 'smallLength'),
      // availabilityFactor, encoderResolution: dimensionless — no conversion
    },
    exits: line.exits.map((e): ExitConfig => ({
      ...e,
      distanceFromInfeed: cv(e.distanceFromInfeed, 'length'),
      laneWidth:          cv(e.laneWidth,          'length'),
      laneLength:         cv(e.laneLength,         'length'),
      exitSpeed:          cv(e.exitSpeed,          'speed'),
      sensorOffset:       cv(e.sensorOffset,       'length'),
      // cycle/extend/retract times are seconds — no conversion
    })),
    skus: line.skus.map((s): ProductSKU => ({
      ...s,
      length: cv(s.length, 'smallLength'),
      width:  cv(s.width,  'smallLength'),
      height: cv(s.height, 'smallLength'),
      weight: cv(s.weight, 'weight'),
      cogHeight: cv(s.cogHeight, 'smallLength'),
    })),
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/utils/unitConverter.test.ts
```

Expected: 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/unitConverter.ts src/utils/unitConverter.test.ts
git commit -m "feat: add unit converter utility + tests"
```

---

### Task 3: Throughput calc + tests

**Files:**
- Create: `src/utils/throughputCalc.ts`
- Create: `src/utils/throughputCalc.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
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

  it('minSpacingFt: 200 fpm belt, 0.4 sec cycle, 10 ms PLC = belt moves ~1.3+ ft', () => {
    const spacing = minSpacingFt(200, 0.4, 10)
    // belt travel in 0.41 sec = 200/60 × 0.41 ≈ 1.367 ft
    expect(spacing).toBeCloseTo(200 / 60 * (0.4 + 0.01), 3)
  })

  it('gapTimeSec: 6 in gap at 200 fpm = 0.15 sec', () => {
    expect(gapTimeSec(6, 200)).toBeCloseTo(0.15, 5)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/utils/throughputCalc.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/utils/throughputCalc.ts`**

```typescript
// src/utils/throughputCalc.ts
// All functions operate in imperial units (ft, ft/min, inches, seconds).
// Convert inputs before calling if working in metric.

/**
 * Maximum products per minute the infeed belt can physically carry.
 * @param beltSpeedFpm  Belt speed in ft/min
 * @param productLengthFt  Longest SKU in ft
 * @param minGapFt  Minimum gap between products in ft
 */
export function theoreticalMaxFeedPPM(
  beltSpeedFpm: number,
  productLengthFt: number,
  minGapFt: number,
): number {
  const pitchFt = productLengthFt + minGapFt
  if (pitchFt <= 0) return 0
  return beltSpeedFpm / pitchFt
}

/**
 * Achievable PPM accounting for scanner read rate and conveyor availability.
 */
export function achievablePPM(
  beltSpeedFpm: number,
  productLengthFt: number,
  minGapFt: number,
  scanReadRate: number,       // 0–1
  availabilityFactor: number, // 0–1
): number {
  return theoreticalMaxFeedPPM(beltSpeedFpm, productLengthFt, minGapFt)
    * scanReadRate
    * availabilityFactor
}

/**
 * Minimum clear distance (ft) between consecutive exit centre-lines so the
 * diverter can complete one full cycle before the next product arrives.
 * @param beltSpeedFpm  Belt speed in ft/min
 * @param diverterCycleTimeSec  Full extend+retract cycle in seconds
 * @param plcLatencyMs  PLC scan + network latency in milliseconds
 */
export function minSpacingFt(
  beltSpeedFpm: number,
  diverterCycleTimeSec: number,
  plcLatencyMs: number,
): number {
  const totalDelaySec = diverterCycleTimeSec + plcLatencyMs / 1000
  return (beltSpeedFpm / 60) * totalDelaySec
}

/**
 * Gap time in seconds between products given gap distance in inches and belt speed in ft/min.
 */
export function gapTimeSec(minGapDistanceIn: number, beltSpeedFpm: number): number {
  const gapFt = minGapDistanceIn / 12
  if (beltSpeedFpm <= 0) return 0
  return (gapFt / beltSpeedFpm) * 60
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/utils/throughputCalc.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/throughputCalc.ts src/utils/throughputCalc.test.ts
git commit -m "feat: add throughput calculation utility + tests"
```

---

### Task 4: Diverter presets

**Files:**
- Create: `src/constants/diverterPresets.ts`

- [ ] **Step 1: Create the presets file**

```typescript
// src/constants/diverterPresets.ts
import type { DiverterPreset, DiverterType } from '../types'

export const DIVERTER_PRESETS: Record<DiverterType, DiverterPreset> = {
  sliding_shoe: {
    type: 'sliding_shoe',
    label: 'Sliding Shoe',
    cycleTimeRange:   [0.30, 0.60],
    extendTimeRange:  [0.15, 0.30],
    retractTimeRange: [0.15, 0.30],
    minProductLength: 6,
    maxProductWeight: 50,
    maxCyclesPerHour: 12_000,
    maxBeltSpeed: 400,
    notes: 'Best for flat-bottom cartons and trays. Very gentle divert.',
  },
  pop_up_roller: {
    type: 'pop_up_roller',
    label: 'Pop-Up Roller',
    cycleTimeRange:   [0.40, 0.80],
    extendTimeRange:  [0.20, 0.40],
    retractTimeRange: [0.20, 0.40],
    minProductLength: 8,
    maxProductWeight: 75,
    maxCyclesPerHour: 9_000,
    maxBeltSpeed: 350,
    notes: 'Handles heavier items. Good for totes and poly bags.',
  },
  arm_pusher: {
    type: 'arm_pusher',
    label: 'Arm Pusher',
    cycleTimeRange:   [0.50, 1.00],
    extendTimeRange:  [0.30, 0.60],
    retractTimeRange: [0.20, 0.40],
    minProductLength: 8,
    maxProductWeight: 100,
    maxCyclesPerHour: 7_200,
    maxBeltSpeed: 300,
    notes: 'High-force divert. Suitable for heavy or irregular packages.',
  },
  mdr_module: {
    type: 'mdr_module',
    label: 'MDR Module',
    cycleTimeRange:   [0.20, 0.40],
    extendTimeRange:  [0.10, 0.20],
    retractTimeRange: [0.10, 0.20],
    minProductLength: 4,
    maxProductWeight: 30,
    maxCyclesPerHour: 18_000,
    maxBeltSpeed: 450,
    notes: 'Motorized Drive Roller. Highest throughput; zero-pressure accumulation.',
  },
  powered_roller: {
    type: 'powered_roller',
    label: 'Powered Roller',
    cycleTimeRange:   [0.30, 0.50],
    extendTimeRange:  [0.15, 0.25],
    retractTimeRange: [0.15, 0.25],
    minProductLength: 6,
    maxProductWeight: 60,
    maxCyclesPerHour: 10_800,
    maxBeltSpeed: 400,
    notes: 'Gentle handling. Good for fragile items.',
  },
}

/** Midpoint of a [min, max] range — used to auto-fill when type changes. */
export function presetMidpoint([min, max]: [number, number]): number {
  return +((min + max) / 2).toFixed(3)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/constants/diverterPresets.ts
git commit -m "feat: add diverter presets constants"
```

---

### Task 5: Validation utility + tests

**Files:**
- Create: `src/utils/validation.ts`
- Create: `src/utils/validation.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/utils/validation.test.ts
import { describe, it, expect } from 'vitest'
import { validateLine } from './validation'
import type { ConveyorLineConfig, ExitConfig, ProductSKU } from '../types'

function baseLine(): ConveyorLineConfig {
  return {
    id: 'l1',
    name: 'Line 1',
    conveyor: { length: 100, width: 3, speed: 200, minGapDistance: 6, availabilityFactor: 0.88, encoderResolution: 100 },
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
    priority: index,
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
  it('returns no issues for a valid config', () => {
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
    line.feed.targetPPM = 500  // impossible at 200 ft/min with 12 in product
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
    line.conveyor.speed = 500  // > 400 ft/min max for sliding_shoe
    const results = validateLine(line, 'imperial')
    expect(results.some(r => r.severity === 'warning' && r.field.startsWith('exits['))).toBe(true)
  })

  it('WARNING: PLC latency > 20 ms at speed > 200 ft/min', () => {
    const line = baseLine()
    line.conveyor.speed = 250
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

  it('no errors when there are no SKUs', () => {
    const line = baseLine()
    line.skus = []
    const results = validateLine(line, 'imperial')
    const criticals = results.filter(r => r.severity === 'critical')
    expect(criticals).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/utils/validation.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/utils/validation.ts`**

```typescript
// src/utils/validation.ts
import type { ConveyorLineConfig, ValidationResult, UnitSystem } from '../types'
import { DIVERTER_PRESETS } from '../constants/diverterPresets'
import { theoreticalMaxFeedPPM, achievablePPM } from './throughputCalc'
import { inToMm, mmToIn, ftToM, mToFt } from './unitConverter'

/**
 * Convert a value in the active unit system to imperial inches (for product dimensions)
 * or imperial ft (for belt dimensions) so we can compare against canonical preset values.
 */
function toImperialIn(v: number, system: UnitSystem): number {
  return system === 'metric' ? mmToIn(v) : v
}
function toImperialFt(v: number, system: UnitSystem): number {
  return system === 'metric' ? mToFt(v) : v
}
function toImperialFpm(v: number, system: UnitSystem): number {
  return system === 'metric' ? v / 0.3048 : v
}

export function validateLine(
  line: ConveyorLineConfig,
  unitSystem: UnitSystem,
): ValidationResult[] {
  const results: ValidationResult[] = []

  const beltSpeedFpm  = toImperialFpm(line.conveyor.speed,          unitSystem)
  const minGapIn      = toImperialIn(line.conveyor.minGapDistance,  unitSystem)
  const minGapFt      = minGapIn / 12

  // ── SKU distribution must sum to 100% (only when 2+ SKUs) ─────────────────
  if (line.skus.length >= 2) {
    const total = line.skus.reduce((sum, s) => sum + s.distributionPercent, 0)
    if (Math.abs(total - 100) > 0.01) {
      results.push({
        severity: 'critical',
        field: 'skus.distributionPercent',
        message: `SKU distribution sums to ${total.toFixed(1)}% — must equal 100%.`,
      })
    }
  }

  // ── targetPPM vs achievable throughput ────────────────────────────────────
  if (line.skus.length > 0 && line.feed.targetPPM > 0) {
    const longestSkuFt = Math.max(
      ...line.skus.map(s => toImperialIn(s.length, unitSystem) / 12),
    )
    const maxPPM = achievablePPM(
      beltSpeedFpm,
      longestSkuFt,
      minGapFt,
      line.feed.scanReadRate,
      line.conveyor.availabilityFactor,
    )
    if (line.feed.targetPPM > maxPPM) {
      results.push({
        severity: 'critical',
        field: 'feed.targetPPM',
        message: `Target ${line.feed.targetPPM} PPM exceeds achievable maximum of ${maxPPM.toFixed(1)} PPM.`,
      })
    }
  }

  // ── Per-exit checks ───────────────────────────────────────────────────────
  line.exits.forEach((exit, idx) => {
    const preset = DIVERTER_PRESETS[exit.diverterType]

    // CRITICAL: SKUs too short for this diverter type
    line.skus.forEach((sku, si) => {
      const lengthIn = toImperialIn(sku.length, unitSystem)
      if (sku.assignedExitId === exit.id && lengthIn < preset.minProductLength) {
        results.push({
          severity: 'critical',
          field: `skus[${si}].length`,
          message: `SKU "${sku.name}" (${lengthIn.toFixed(1)} in) is shorter than the ${preset.label} minimum of ${preset.minProductLength} in.`,
        })
      }
    })

    // WARNING: belt speed exceeds diverter recommended max
    if (beltSpeedFpm > preset.maxBeltSpeed) {
      results.push({
        severity: 'warning',
        field: `exits[${idx}].diverterType`,
        message: `Belt speed ${beltSpeedFpm} ft/min exceeds ${preset.label} recommended maximum of ${preset.maxBeltSpeed} ft/min.`,
      })
    }
  })

  // ── WARNING: PLC latency > 20 ms at speed > 200 fpm ───────────────────────
  if (line.feed.plcLatencyMs > 20 && beltSpeedFpm > 200) {
    results.push({
      severity: 'warning',
      field: 'feed.plcLatencyMs',
      message: `PLC latency ${line.feed.plcLatencyMs} ms is high for belt speed ${beltSpeedFpm.toFixed(0)} ft/min. Consider < 20 ms.`,
    })
  }

  // ── INFO: all exits on the same side ─────────────────────────────────────
  if (line.exits.length >= 2) {
    const sides = new Set(line.exits.map(e => e.side))
    if (sides.size === 1) {
      results.push({
        severity: 'info',
        field: 'exits',
        message: 'All exits are on the same side. Consider adding exits on the opposite side to balance throughput.',
      })
    }
  }

  return results
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/utils/validation.test.ts
```

Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/validation.ts src/utils/validation.test.ts
git commit -m "feat: add validation utility + tests"
```

---

### Task 6: Config Zustand store + tests

**Files:**
- Create: `src/store/configStore.ts`
- Create: `src/store/configStore.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/store/configStore.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Supabase before importing the store
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  },
}))

import { useConfigStore } from './configStore'

describe('configStore', () => {
  beforeEach(() => {
    useConfigStore.setState(useConfigStore.getInitialState())
  })

  it('initial state has no lines and no projectId', () => {
    const { projectId, lines } = useConfigStore.getState()
    expect(projectId).toBeNull()
    expect(lines).toHaveLength(0)
  })

  it('addLine: adds a line with default values', () => {
    useConfigStore.getState().addLine()
    const { lines } = useConfigStore.getState()
    expect(lines).toHaveLength(1)
    expect(lines[0].name).toBe('Line 1')
    expect(lines[0].conveyor.speed).toBe(200)
  })

  it('addLine twice: names are Line 1 and Line 2', () => {
    useConfigStore.getState().addLine()
    useConfigStore.getState().addLine()
    const { lines } = useConfigStore.getState()
    expect(lines[0].name).toBe('Line 1')
    expect(lines[1].name).toBe('Line 2')
  })

  it('removeLine: removes the correct line', () => {
    useConfigStore.getState().addLine()
    useConfigStore.getState().addLine()
    const { lines } = useConfigStore.getState()
    const idToRemove = lines[0].id
    useConfigStore.getState().removeLine(idToRemove)
    expect(useConfigStore.getState().lines).toHaveLength(1)
    expect(useConfigStore.getState().lines[0].id).not.toBe(idToRemove)
  })

  it('renameLine: updates the line name', () => {
    useConfigStore.getState().addLine()
    const id = useConfigStore.getState().lines[0].id
    useConfigStore.getState().renameLine(id, 'Zone A')
    expect(useConfigStore.getState().lines[0].name).toBe('Zone A')
  })

  it('updateConveyor: updates a specific conveyor field', () => {
    useConfigStore.getState().addLine()
    const id = useConfigStore.getState().lines[0].id
    useConfigStore.getState().updateConveyor(id, { speed: 350 })
    expect(useConfigStore.getState().lines[0].conveyor.speed).toBe(350)
  })

  it('addExit / removeExit round-trip', () => {
    useConfigStore.getState().addLine()
    const lineId = useConfigStore.getState().lines[0].id
    useConfigStore.getState().addExit(lineId)
    expect(useConfigStore.getState().lines[0].exits).toHaveLength(1)
    const exitId = useConfigStore.getState().lines[0].exits[0].id
    useConfigStore.getState().removeExit(lineId, exitId)
    expect(useConfigStore.getState().lines[0].exits).toHaveLength(0)
  })

  it('addSKU / removeSKU round-trip', () => {
    useConfigStore.getState().addLine()
    const lineId = useConfigStore.getState().lines[0].id
    useConfigStore.getState().addSKU(lineId)
    expect(useConfigStore.getState().lines[0].skus).toHaveLength(1)
    const skuId = useConfigStore.getState().lines[0].skus[0].id
    useConfigStore.getState().removeSKU(lineId, skuId)
    expect(useConfigStore.getState().lines[0].skus).toHaveLength(0)
  })

  it('convertToSystem: converts conveyor speed from imperial to metric', () => {
    useConfigStore.setState({ unitSystem: 'imperial' })
    useConfigStore.getState().addLine()
    const originalSpeed = useConfigStore.getState().lines[0].conveyor.speed // 200 ft/min
    useConfigStore.getState().convertToSystem('metric')
    const newSpeed = useConfigStore.getState().lines[0].conveyor.speed
    expect(newSpeed).toBeCloseTo(originalSpeed * 0.3048, 4)
  })

  it('setIsDirty: marks store as dirty', () => {
    expect(useConfigStore.getState().isDirty).toBe(false)
    useConfigStore.getState().setIsDirty(true)
    expect(useConfigStore.getState().isDirty).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/store/configStore.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/store/configStore.ts`**

```typescript
// src/store/configStore.ts
import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'
import type {
  ConveyorConfig, ConveyorLineConfig, ExitConfig, FeedConfig,
  ProductSKU, ProjectConfig, ProjectVersion, UnitSystem,
} from '../types'
import { convertLineConfig } from '../utils/unitConverter'

// ── Default factory functions ─────────────────────────────────────────────────
function defaultConveyorConfig(): ConveyorConfig {
  return {
    length: 100, width: 3, speed: 200,
    minGapDistance: 6, availabilityFactor: 0.88, encoderResolution: 100,
  }
}

function defaultFeedConfig(): FeedConfig {
  return {
    mode: 'horizontal', targetPPM: 30, mixedDimensions: false,
    singulated: true, metered: true, scanReadRate: 0.99, plcLatencyMs: 10,
  }
}

function defaultExit(index: number): ExitConfig {
  return {
    id: crypto.randomUUID(),
    index,
    side: 'right',
    distanceFromInfeed: 20 * (index + 1),
    laneWidth: 3,
    laneLength: 10,
    exitSpeed: 150,
    maxQueueDepth: 10,
    angle: 45,
    diverterType: 'sliding_shoe',
    diverterCycleTime: 0.45,
    diverterExtendTime: 0.225,
    diverterRetractTime: 0.225,
    sensorOffset: 2,
    priority: index,
  }
}

const SKU_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#6366f1',
]

function defaultSKU(index: number): ProductSKU {
  return {
    id: crypto.randomUUID(),
    name: `SKU ${index + 1}`,
    length: 12, width: 8, height: 6, weight: 5,
    orientation: 'long_axis_parallel',
    packagingType: 'rigid_carton',
    cogHeight: 3,
    distributionPercent: 100,
    assignedExitId: null,
    color: SKU_COLORS[index % SKU_COLORS.length],
  }
}

function defaultLine(index: number): ConveyorLineConfig {
  return {
    id: crypto.randomUUID(),
    name: `Line ${index + 1}`,
    conveyor: defaultConveyorConfig(),
    exits: [],
    feed: defaultFeedConfig(),
    skus: [],
    recirculationEnabled: false,
    recirculationDelaySec: 30,
    noReadExitId: null,
    randomSeed: Math.floor(Math.random() * 1_000_000),
  }
}

// ── Store interface ───────────────────────────────────────────────────────────
interface ConfigStore {
  projectId: string | null
  projectName: string
  unitSystem: UnitSystem
  lines: ConveyorLineConfig[]
  activeLineId: string | null
  isDirty: boolean
  versions: ProjectVersion[]
  versionsLoading: boolean
  saveLoading: boolean
  configLoading: boolean
  error: string | null

  // Expose for test reset
  getInitialState: () => Partial<ConfigStore>

  // Sync actions
  setActiveLineId: (id: string) => void
  addLine: () => void
  removeLine: (id: string) => void
  renameLine: (id: string, name: string) => void
  duplicateLine: (id: string) => void
  updateConveyor: (lineId: string, partial: Partial<ConveyorConfig>) => void
  updateFeed: (lineId: string, partial: Partial<FeedConfig>) => void
  addExit: (lineId: string) => void
  updateExit: (lineId: string, exitId: string, partial: Partial<ExitConfig>) => void
  removeExit: (lineId: string, exitId: string) => void
  addSKU: (lineId: string) => void
  updateSKU: (lineId: string, skuId: string, partial: Partial<ProductSKU>) => void
  removeSKU: (lineId: string, skuId: string) => void
  convertToSystem: (target: UnitSystem) => void
  setIsDirty: (dirty: boolean) => void

  // Async Supabase actions
  loadConfig: (projectId: string, projectName: string, unitSystem: UnitSystem) => Promise<void>
  saveVersion: (label?: string) => Promise<void>
  fetchVersions: () => Promise<void>
  restoreVersion: (version: ProjectVersion) => void
}

const INITIAL: Omit<ConfigStore, 
  'getInitialState'|'setActiveLineId'|'addLine'|'removeLine'|'renameLine'|
  'duplicateLine'|'updateConveyor'|'updateFeed'|'addExit'|'updateExit'|
  'removeExit'|'addSKU'|'updateSKU'|'removeSKU'|'convertToSystem'|'setIsDirty'|
  'loadConfig'|'saveVersion'|'fetchVersions'|'restoreVersion'
> = {
  projectId: null,
  projectName: '',
  unitSystem: 'imperial',
  lines: [],
  activeLineId: null,
  isDirty: false,
  versions: [],
  versionsLoading: false,
  saveLoading: false,
  configLoading: false,
  error: null,
}

// Helper: update a line in the array by id
function updateLine(
  lines: ConveyorLineConfig[],
  lineId: string,
  fn: (l: ConveyorLineConfig) => ConveyorLineConfig,
): ConveyorLineConfig[] {
  return lines.map(l => l.id === lineId ? fn(l) : l)
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  ...INITIAL,

  getInitialState: () => INITIAL,

  setActiveLineId: (id) => set({ activeLineId: id }),

  addLine: () => {
    const index = get().lines.length
    const line = defaultLine(index)
    set(s => ({
      lines: [...s.lines, line],
      activeLineId: s.activeLineId ?? line.id,
      isDirty: true,
    }))
  },

  removeLine: (id) => {
    const remaining = get().lines.filter(l => l.id !== id)
    set({
      lines: remaining,
      activeLineId: remaining[0]?.id ?? null,
      isDirty: true,
    })
  },

  renameLine: (id, name) => set(s => ({
    lines: updateLine(s.lines, id, l => ({ ...l, name })),
    isDirty: true,
  })),

  duplicateLine: (id) => {
    const source = get().lines.find(l => l.id === id)
    if (!source) return
    const copy: ConveyorLineConfig = {
      ...JSON.parse(JSON.stringify(source)),
      id: crypto.randomUUID(),
      name: source.name + ' (copy)',
    }
    set(s => ({ lines: [...s.lines, copy], activeLineId: copy.id, isDirty: true }))
  },

  updateConveyor: (lineId, partial) => set(s => ({
    lines: updateLine(s.lines, lineId, l => ({ ...l, conveyor: { ...l.conveyor, ...partial } })),
    isDirty: true,
  })),

  updateFeed: (lineId, partial) => set(s => ({
    lines: updateLine(s.lines, lineId, l => ({ ...l, feed: { ...l.feed, ...partial } })),
    isDirty: true,
  })),

  addExit: (lineId) => set(s => ({
    lines: updateLine(s.lines, lineId, l => {
      const exit = defaultExit(l.exits.length)
      return { ...l, exits: [...l.exits, exit] }
    }),
    isDirty: true,
  })),

  updateExit: (lineId, exitId, partial) => set(s => ({
    lines: updateLine(s.lines, lineId, l => ({
      ...l,
      exits: l.exits.map(e => e.id === exitId ? { ...e, ...partial } : e),
    })),
    isDirty: true,
  })),

  removeExit: (lineId, exitId) => set(s => ({
    lines: updateLine(s.lines, lineId, l => ({
      ...l,
      exits: l.exits.filter(e => e.id !== exitId),
    })),
    isDirty: true,
  })),

  addSKU: (lineId) => set(s => ({
    lines: updateLine(s.lines, lineId, l => {
      const sku = defaultSKU(l.skus.length)
      return { ...l, skus: [...l.skus, sku] }
    }),
    isDirty: true,
  })),

  updateSKU: (lineId, skuId, partial) => set(s => ({
    lines: updateLine(s.lines, lineId, l => ({
      ...l,
      skus: l.skus.map(sk => sk.id === skuId ? { ...sk, ...partial } : sk),
    })),
    isDirty: true,
  })),

  removeSKU: (lineId, skuId) => set(s => ({
    lines: updateLine(s.lines, lineId, l => ({
      ...l,
      skus: l.skus.filter(sk => sk.id !== skuId),
    })),
    isDirty: true,
  })),

  convertToSystem: (target) => {
    const current = get().unitSystem
    if (current === target) return
    set(s => ({
      unitSystem: target,
      lines: s.lines.map(l => convertLineConfig(l, current, target)),
      isDirty: true,
    }))
  },

  setIsDirty: (dirty) => set({ isDirty: dirty }),

  // ── Supabase async ──────────────────────────────────────────────────────────
  loadConfig: async (projectId, projectName, unitSystem) => {
    set({ configLoading: true, error: null, projectId, projectName, unitSystem })
    const { data, error } = await supabase
      .from('project_versions')
      .select('*')
      .eq('project_id', projectId)
      .order('version_num', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      // No version yet — start with one default line
      const line = defaultLine(0)
      set({
        configLoading: false,
        lines: [line],
        activeLineId: line.id,
        isDirty: false,
        versions: [],
      })
      return
    }
    const config = (data as ProjectVersion).config_json
    set({
      configLoading: false,
      lines: config.lines,
      activeLineId: config.lines[0]?.id ?? null,
      isDirty: false,
    })
    get().fetchVersions()
  },

  saveVersion: async (label) => {
    const { projectId, projectName, unitSystem, lines } = get()
    if (!projectId) return
    set({ saveLoading: true, error: null })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { set({ saveLoading: false, error: 'Not authenticated' }); return }

    const config: ProjectConfig = { projectId, projectName, unitSystem, lines }
    const { error } = await supabase
      .from('project_versions')
      .insert({ project_id: projectId, label: label ?? null, config_json: config, created_by: user.id })

    if (error) { set({ saveLoading: false, error: error.message }); return }
    set({ saveLoading: false, isDirty: false })
    get().fetchVersions()
  },

  fetchVersions: async () => {
    const { projectId } = get()
    if (!projectId) return
    set({ versionsLoading: true })
    const { data, error } = await supabase
      .from('project_versions')
      .select('id, project_id, version_num, label, created_at, created_by')
      .eq('project_id', projectId)
      .order('version_num', { ascending: false })
    if (!error && data) {
      set({ versions: data as ProjectVersion[], versionsLoading: false })
    } else {
      set({ versionsLoading: false })
    }
  },

  restoreVersion: (version) => {
    const config = version.config_json
    set({
      lines: config.lines,
      activeLineId: config.lines[0]?.id ?? null,
      isDirty: true,
    })
  },
}))
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/store/configStore.test.ts
```

Expected: 10 tests PASS.

- [ ] **Step 5: Run the full test suite**

```bash
npx vitest run
```

Expected: all previous tests + 10 new = ~34 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store/configStore.ts src/store/configStore.test.ts
git commit -m "feat: add config Zustand store + tests"
```

---

### Task 7: Supabase `project_versions` migration

**Files:** none — run SQL in the Supabase SQL Editor

- [ ] **Step 1: Open the Supabase dashboard SQL Editor**

Go to https://supabase.com/dashboard/project/jximphmkqerwuxfvcoom/sql/new

- [ ] **Step 2: Run this SQL**

```sql
-- project_versions table
create table public.project_versions (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references public.projects on delete cascade not null,
  version_num  integer not null default 1,
  label        text,
  config_json  jsonb not null,
  results_json jsonb,
  created_at   timestamptz default now(),
  created_by   uuid references auth.users not null
);

-- Auto-increment version_num per project
create or replace function public.set_version_num()
returns trigger language plpgsql as $$
begin
  select coalesce(max(version_num), 0) + 1
  into   new.version_num
  from   public.project_versions
  where  project_id = new.project_id;
  return new;
end;
$$;

create trigger trg_project_versions_num
  before insert on public.project_versions
  for each row execute function public.set_version_num();

-- Row-level security
alter table public.project_versions enable row level security;

create policy "owners can select their project versions"
  on public.project_versions for select
  using (
    exists (
      select 1 from public.projects
      where id = project_versions.project_id
        and owner_id = auth.uid()
    )
  );

create policy "owners can insert their project versions"
  on public.project_versions for insert
  with check (
    exists (
      select 1 from public.projects
      where id = project_versions.project_id
        and owner_id = auth.uid()
    )
  );
```

- [ ] **Step 3: Verify the table was created**

In the Table Editor, confirm `project_versions` appears under public schema.

---

### Task 8: Shared input components

**Files:**
- Create: `src/components/shared/InputField.tsx`
- Create: `src/components/shared/SelectField.tsx`
- Create: `src/components/shared/ValidationBadge.tsx`

- [ ] **Step 1: Create `InputField.tsx`**

```tsx
// src/components/shared/InputField.tsx
interface InputFieldProps {
  label: string
  value: number | string
  onChange: (value: number | string) => void
  type?: 'number' | 'text'
  unit?: string
  min?: number
  max?: number
  step?: number
  error?: string
  hint?: string
  disabled?: boolean
}

export function InputField({
  label, value, onChange, type = 'number',
  unit, min, max, step, error, hint, disabled,
}: InputFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type={type}
          value={value}
          min={min}
          max={max}
          step={step ?? (type === 'number' ? 'any' : undefined)}
          disabled={disabled}
          onChange={e =>
            onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)
          }
          className={`w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 ${
            error
              ? 'border-red-400 focus:ring-red-300'
              : 'border-gray-300 focus:ring-blue-300'
          } disabled:bg-gray-50 disabled:text-gray-400`}
        />
        {unit && (
          <span className="shrink-0 rounded bg-gray-100 px-1.5 py-1 text-xs text-gray-500">
            {unit}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Create `SelectField.tsx`**

```tsx
// src/components/shared/SelectField.tsx
interface Option<T extends string = string> {
  value: T
  label: string
}

interface SelectFieldProps<T extends string> {
  label: string
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  disabled?: boolean
}

export function SelectField<T extends string>({
  label, value, options, onChange, disabled,
}: SelectFieldProps<T>) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value as T)}
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300 disabled:bg-gray-50 disabled:text-gray-400"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 3: Create `ValidationBadge.tsx`**

```tsx
// src/components/shared/ValidationBadge.tsx
import type { ValidationResult, ValidationSeverity } from '../../types'

const styles: Record<ValidationSeverity, string> = {
  critical: 'bg-red-50 border-red-300 text-red-700',
  warning:  'bg-amber-50 border-amber-300 text-amber-700',
  info:     'bg-blue-50 border-blue-300 text-blue-700',
}

const icons: Record<ValidationSeverity, string> = {
  critical: '✕',
  warning:  '⚠',
  info:     'ℹ',
}

interface Props {
  results: ValidationResult[]
}

export function ValidationBadge({ results }: Props) {
  if (results.length === 0) return null
  return (
    <div className="flex flex-col gap-1 mt-1">
      {results.map((r, i) => (
        <div
          key={i}
          className={`flex items-start gap-1.5 rounded border px-2 py-1 text-xs ${styles[r.severity]}`}
        >
          <span className="shrink-0 font-bold">{icons[r.severity]}</span>
          <span>{r.message}</span>
        </div>
      ))}
    </div>
  )
}

/** Convenience: returns results that match a specific field prefix */
export function fieldResults(results: ValidationResult[], field: string): ValidationResult[] {
  return results.filter(r => r.field === field || r.field.startsWith(field + '['))
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/InputField.tsx src/components/shared/SelectField.tsx src/components/shared/ValidationBadge.tsx
git commit -m "feat: add shared InputField, SelectField, ValidationBadge components"
```

---

### Task 9: ConveyorConfigPanel

**Files:**
- Create: `src/components/config/ConveyorConfigPanel.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/config/ConveyorConfigPanel.tsx
import { useConfigStore } from '../../store/configStore'
import { useProjectStore } from '../../store/projectStore'
import { InputField } from '../shared/InputField'
import { ValidationBadge, fieldResults } from '../shared/ValidationBadge'
import { validateLine } from '../../utils/validation'
import { unitLabel } from '../../utils/unitConverter'
import { gapTimeSec } from '../../utils/throughputCalc'
import type { ConveyorLineConfig } from '../../types'

interface Props {
  line: ConveyorLineConfig
}

export function ConveyorConfigPanel({ line }: Props) {
  const updateConveyor = useConfigStore(s => s.updateConveyor)
  const unitSystem = useProjectStore(s => s.unitSystem)

  const validationResults = validateLine(line, unitSystem)
  const lenUnit   = unitLabel('length',      unitSystem)
  const speedUnit = unitLabel('speed',       unitSystem)
  const gapUnit   = unitLabel('smallLength', unitSystem)

  const gapSec = gapTimeSec(
    unitSystem === 'imperial' ? line.conveyor.minGapDistance : line.conveyor.minGapDistance / 25.4,
    unitSystem === 'imperial' ? line.conveyor.speed : line.conveyor.speed / 0.3048,
  )

  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="text-sm font-semibold text-gray-800">Conveyor</h3>

      <InputField
        label="Belt Length"
        value={+line.conveyor.length.toFixed(3)}
        onChange={v => updateConveyor(line.id, { length: v as number })}
        unit={lenUnit}
        min={1}
        max={unitSystem === 'imperial' ? 2000 : 600}
        step={unitSystem === 'imperial' ? 1 : 0.1}
      />

      <InputField
        label="Belt Width"
        value={+line.conveyor.width.toFixed(3)}
        onChange={v => updateConveyor(line.id, { width: v as number })}
        unit={lenUnit}
        min={0.5}
        max={unitSystem === 'imperial' ? 10 : 3}
        step={unitSystem === 'imperial' ? 0.25 : 0.05}
      />

      <InputField
        label="Belt Speed"
        value={+line.conveyor.speed.toFixed(2)}
        onChange={v => updateConveyor(line.id, { speed: v as number })}
        unit={speedUnit}
        min={1}
        max={unitSystem === 'imperial' ? 600 : 183}
        step={unitSystem === 'imperial' ? 5 : 1}
      />
      <ValidationBadge results={fieldResults(validationResults, 'conveyor.speed')} />

      <InputField
        label="Min Gap Distance"
        value={+line.conveyor.minGapDistance.toFixed(2)}
        onChange={v => updateConveyor(line.id, { minGapDistance: v as number })}
        unit={gapUnit}
        min={0}
        step={unitSystem === 'imperial' ? 0.5 : 5}
        hint={`Gap time: ${gapSec.toFixed(3)} sec`}
      />

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">
          Availability Factor
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.5}
            max={1}
            step={0.01}
            value={line.conveyor.availabilityFactor}
            onChange={e => updateConveyor(line.id, { availabilityFactor: parseFloat(e.target.value) })}
            className="flex-1"
          />
          <span className="w-12 text-right text-sm tabular-nums">
            {(line.conveyor.availabilityFactor * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      <InputField
        label="Encoder Resolution"
        value={line.conveyor.encoderResolution}
        onChange={v => updateConveyor(line.id, { encoderResolution: v as number })}
        unit={`pulses/${lenUnit}`}
        min={1}
        max={10000}
        step={10}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/config/ConveyorConfigPanel.tsx
git commit -m "feat: add ConveyorConfigPanel"
```

---

### Task 10: ExitConfigPanel

**Files:**
- Create: `src/components/config/ExitConfigPanel.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/config/ExitConfigPanel.tsx
import { useState } from 'react'
import { useConfigStore } from '../../store/configStore'
import { useProjectStore } from '../../store/projectStore'
import { InputField } from '../shared/InputField'
import { SelectField } from '../shared/SelectField'
import { ValidationBadge, fieldResults } from '../shared/ValidationBadge'
import { validateLine } from '../../utils/validation'
import { unitLabel } from '../../utils/unitConverter'
import { DIVERTER_PRESETS, presetMidpoint } from '../../constants/diverterPresets'
import type { ConveyorLineConfig, DiverterType, ExitSide, DivertAngle } from '../../types'

interface Props {
  line: ConveyorLineConfig
}

const SIDE_OPTIONS: { value: ExitSide; label: string }[] = [
  { value: 'left',  label: 'Left'  },
  { value: 'right', label: 'Right' },
]

const ANGLE_OPTIONS: { value: string; label: string }[] = [
  { value: '30', label: '30°' },
  { value: '45', label: '45°' },
  { value: '90', label: '90°' },
]

const DIVERTER_OPTIONS: { value: DiverterType; label: string }[] = [
  { value: 'sliding_shoe',   label: 'Sliding Shoe'   },
  { value: 'pop_up_roller',  label: 'Pop-Up Roller'  },
  { value: 'arm_pusher',     label: 'Arm Pusher'     },
  { value: 'mdr_module',     label: 'MDR Module'     },
  { value: 'powered_roller', label: 'Powered Roller' },
]

export function ExitConfigPanel({ line }: Props) {
  const { addExit, updateExit, removeExit } = useConfigStore(s => ({
    addExit: s.addExit,
    updateExit: s.updateExit,
    removeExit: s.removeExit,
  }))
  const unitSystem = useProjectStore(s => s.unitSystem)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const validationResults = validateLine(line, unitSystem)
  const lenUnit = unitLabel('length', unitSystem)
  const speedUnit = unitLabel('speed', unitSystem)

  function applyPreset(exitId: string, type: DiverterType) {
    const p = DIVERTER_PRESETS[type]
    updateExit(line.id, exitId, {
      diverterType:        type,
      diverterCycleTime:   presetMidpoint(p.cycleTimeRange),
      diverterExtendTime:  presetMidpoint(p.extendTimeRange),
      diverterRetractTime: presetMidpoint(p.retractTimeRange),
    })
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Exits ({line.exits.length})</h3>
        <button
          onClick={() => addExit(line.id)}
          className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
        >
          + Add Exit
        </button>
      </div>

      {line.exits.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">No exits yet. Add one above.</p>
      )}

      {line.exits.map((exit, idx) => (
        <div key={exit.id} className="rounded border border-gray-200 bg-gray-50">
          {/* Header row */}
          <div className="flex items-center justify-between px-3 py-2">
            <button
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              onClick={() => setExpandedId(expandedId === exit.id ? null : exit.id)}
            >
              <span>{expandedId === exit.id ? '▼' : '▶'}</span>
              Exit {idx + 1} — {exit.side}, {exit.distanceFromInfeed.toFixed(1)} {lenUnit}
            </button>
            <button
              onClick={() => removeExit(line.id, exit.id)}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Remove
            </button>
          </div>

          <ValidationBadge results={fieldResults(validationResults, `exits[${idx}]`)} />

          {/* Expanded fields */}
          {expandedId === exit.id && (
            <div className="flex flex-col gap-3 border-t border-gray-200 px-3 pb-3 pt-3">
              <SelectField
                label="Side"
                value={exit.side}
                options={SIDE_OPTIONS}
                onChange={v => updateExit(line.id, exit.id, { side: v as ExitSide })}
              />
              <InputField
                label="Distance from Infeed"
                value={+exit.distanceFromInfeed.toFixed(2)}
                onChange={v => updateExit(line.id, exit.id, { distanceFromInfeed: v as number })}
                unit={lenUnit}
                min={0}
                step={unitSystem === 'imperial' ? 1 : 0.1}
              />
              <InputField
                label="Lane Width"
                value={+exit.laneWidth.toFixed(2)}
                onChange={v => updateExit(line.id, exit.id, { laneWidth: v as number })}
                unit={lenUnit}
                min={0.5}
                step={unitSystem === 'imperial' ? 0.25 : 0.05}
              />
              <InputField
                label="Lane Length"
                value={+exit.laneLength.toFixed(2)}
                onChange={v => updateExit(line.id, exit.id, { laneLength: v as number })}
                unit={lenUnit}
                min={1}
                step={unitSystem === 'imperial' ? 1 : 0.1}
              />
              <InputField
                label="Exit Belt Speed"
                value={+exit.exitSpeed.toFixed(2)}
                onChange={v => updateExit(line.id, exit.id, { exitSpeed: v as number })}
                unit={speedUnit}
                min={1}
              />
              <InputField
                label="Max Queue Depth"
                value={exit.maxQueueDepth}
                onChange={v => updateExit(line.id, exit.id, { maxQueueDepth: v as number })}
                unit="products"
                min={1}
                max={100}
                step={1}
              />
              <SelectField
                label="Divert Angle"
                value={String(exit.angle)}
                options={ANGLE_OPTIONS}
                onChange={v => updateExit(line.id, exit.id, { angle: parseInt(v) as DivertAngle })}
              />

              {/* Diverter type — changes auto-fill preset values */}
              <div className="flex flex-col gap-1">
                <SelectField
                  label="Diverter Type"
                  value={exit.diverterType}
                  options={DIVERTER_OPTIONS}
                  onChange={type => applyPreset(exit.id, type as DiverterType)}
                />
                <p className="text-xs text-gray-400 italic">
                  {DIVERTER_PRESETS[exit.diverterType].notes}
                </p>
              </div>

              <InputField
                label="Cycle Time"
                value={exit.diverterCycleTime}
                onChange={v => updateExit(line.id, exit.id, { diverterCycleTime: v as number })}
                unit="sec"
                min={0.1}
                max={5}
                step={0.01}
                hint={`Range: ${DIVERTER_PRESETS[exit.diverterType].cycleTimeRange.join('–')} sec`}
              />
              <InputField
                label="Extend Time"
                value={exit.diverterExtendTime}
                onChange={v => updateExit(line.id, exit.id, { diverterExtendTime: v as number })}
                unit="sec"
                min={0.05}
                step={0.01}
              />
              <InputField
                label="Retract Time"
                value={exit.diverterRetractTime}
                onChange={v => updateExit(line.id, exit.id, { diverterRetractTime: v as number })}
                unit="sec"
                min={0.05}
                step={0.01}
              />
              <InputField
                label="Sensor Offset"
                value={+exit.sensorOffset.toFixed(2)}
                onChange={v => updateExit(line.id, exit.id, { sensorOffset: v as number })}
                unit={lenUnit}
                min={0}
                step={0.1}
                hint="Distance upstream from divert centre"
              />
              <InputField
                label="Priority"
                value={exit.priority}
                onChange={v => updateExit(line.id, exit.id, { priority: v as number })}
                unit=""
                min={0}
                step={1}
                hint="Lower = higher priority when overflow"
              />
            </div>
          )}
        </div>
      ))}

      <ValidationBadge results={fieldResults(validationResults, 'exits')} />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/config/ExitConfigPanel.tsx
git commit -m "feat: add ExitConfigPanel with diverter preset auto-fill"
```

---

### Task 11: ProductConfigPanel

**Files:**
- Create: `src/components/config/ProductConfigPanel.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/config/ProductConfigPanel.tsx
import { useState } from 'react'
import { useConfigStore } from '../../store/configStore'
import { useProjectStore } from '../../store/projectStore'
import { InputField } from '../shared/InputField'
import { SelectField } from '../shared/SelectField'
import { ValidationBadge, fieldResults } from '../shared/ValidationBadge'
import { validateLine } from '../../utils/validation'
import { unitLabel } from '../../utils/unitConverter'
import type { ConveyorLineConfig, PackagingType, ProductOrientation } from '../../types'

interface Props { line: ConveyorLineConfig }

const PKG_OPTIONS: { value: PackagingType; label: string }[] = [
  { value: 'rigid_carton', label: 'Rigid Carton' },
  { value: 'poly_bag',     label: 'Poly Bag'     },
  { value: 'tote',         label: 'Tote'         },
  { value: 'loose_item',   label: 'Loose Item'   },
]

const ORIENTATION_OPTIONS: { value: ProductOrientation; label: string }[] = [
  { value: 'long_axis_parallel',      label: 'Long-axis parallel'      },
  { value: 'long_axis_perpendicular', label: 'Long-axis perpendicular' },
]

export function ProductConfigPanel({ line }: Props) {
  const { addSKU, updateSKU, removeSKU } = useConfigStore(s => ({
    addSKU: s.addSKU, updateSKU: s.updateSKU, removeSKU: s.removeSKU,
  }))
  const unitSystem = useProjectStore(s => s.unitSystem)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const validationResults = validateLine(line, unitSystem)
  const dimUnit    = unitLabel('smallLength', unitSystem)
  const weightUnit = unitLabel('weight',      unitSystem)

  const exitOptions = [
    { value: '', label: '— Unassigned —' },
    ...line.exits.map((e, i) => ({ value: e.id, label: `Exit ${i + 1} (${e.side})` })),
  ]

  const totalDist = line.skus.reduce((s, sk) => s + sk.distributionPercent, 0)

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Products / SKUs ({line.skus.length})</h3>
        <button
          onClick={() => addSKU(line.id)}
          className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
        >
          + Add SKU
        </button>
      </div>

      {line.skus.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">No SKUs yet. Add one above.</p>
      )}

      {/* Distribution summary */}
      {line.skus.length >= 2 && (
        <div className={`rounded border px-2 py-1 text-xs ${
          Math.abs(totalDist - 100) < 0.01
            ? 'border-green-300 bg-green-50 text-green-700'
            : 'border-red-300 bg-red-50 text-red-700'
        }`}>
          Distribution total: {totalDist.toFixed(1)}% {Math.abs(totalDist - 100) < 0.01 ? '✓' : '(must equal 100%)'}
        </div>
      )}

      <ValidationBadge results={fieldResults(validationResults, 'skus.distributionPercent')} />

      {line.skus.map((sku, idx) => (
        <div key={sku.id} className="rounded border border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between px-3 py-2">
            <button
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              onClick={() => setExpandedId(expandedId === sku.id ? null : sku.id)}
            >
              <span
                className="inline-block h-3 w-3 rounded-full border border-gray-300"
                style={{ background: sku.color }}
              />
              <span>{expandedId === sku.id ? '▼' : '▶'}</span>
              {sku.name} — {sku.distributionPercent}%
            </button>
            <button
              onClick={() => removeSKU(line.id, sku.id)}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Remove
            </button>
          </div>

          <ValidationBadge results={fieldResults(validationResults, `skus[${idx}]`)} />

          {expandedId === sku.id && (
            <div className="flex flex-col gap-3 border-t border-gray-200 px-3 pb-3 pt-3">
              <InputField
                label="SKU Name"
                type="text"
                value={sku.name}
                onChange={v => updateSKU(line.id, sku.id, { name: v as string })}
              />

              <div className="grid grid-cols-3 gap-2">
                <InputField
                  label="Length"
                  value={+sku.length.toFixed(1)}
                  onChange={v => updateSKU(line.id, sku.id, { length: v as number })}
                  unit={dimUnit}
                  min={1}
                  step={unitSystem === 'imperial' ? 0.5 : 5}
                />
                <InputField
                  label="Width"
                  value={+sku.width.toFixed(1)}
                  onChange={v => updateSKU(line.id, sku.id, { width: v as number })}
                  unit={dimUnit}
                  min={1}
                  step={unitSystem === 'imperial' ? 0.5 : 5}
                />
                <InputField
                  label="Height"
                  value={+sku.height.toFixed(1)}
                  onChange={v => updateSKU(line.id, sku.id, { height: v as number })}
                  unit={dimUnit}
                  min={1}
                  step={unitSystem === 'imperial' ? 0.5 : 5}
                />
              </div>

              <InputField
                label="Weight"
                value={+sku.weight.toFixed(2)}
                onChange={v => updateSKU(line.id, sku.id, { weight: v as number })}
                unit={weightUnit}
                min={0.1}
                step={0.1}
              />

              <InputField
                label="CoG Height"
                value={+sku.cogHeight.toFixed(1)}
                onChange={v => updateSKU(line.id, sku.id, { cogHeight: v as number })}
                unit={dimUnit}
                min={0}
                hint="Centre-of-gravity height"
              />

              <SelectField
                label="Packaging Type"
                value={sku.packagingType}
                options={PKG_OPTIONS}
                onChange={v => updateSKU(line.id, sku.id, { packagingType: v as PackagingType })}
              />

              <SelectField
                label="Orientation"
                value={sku.orientation}
                options={ORIENTATION_OPTIONS}
                onChange={v => updateSKU(line.id, sku.id, { orientation: v as ProductOrientation })}
              />

              <InputField
                label="Distribution %"
                value={sku.distributionPercent}
                onChange={v => updateSKU(line.id, sku.id, { distributionPercent: v as number })}
                unit="%"
                min={0}
                max={100}
                step={1}
              />

              <SelectField
                label="Assigned Exit"
                value={sku.assignedExitId ?? ''}
                options={exitOptions}
                onChange={v => updateSKU(line.id, sku.id, { assignedExitId: v || null })}
              />

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Colour</label>
                <input
                  type="color"
                  value={sku.color}
                  onChange={e => updateSKU(line.id, sku.id, { color: e.target.value })}
                  className="h-8 w-16 cursor-pointer rounded border border-gray-300 p-0.5"
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/config/ProductConfigPanel.tsx
git commit -m "feat: add ProductConfigPanel (SKU list)"
```

---

### Task 12: FeedConfigPanel

**Files:**
- Create: `src/components/config/FeedConfigPanel.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/config/FeedConfigPanel.tsx
import { useConfigStore } from '../../store/configStore'
import { useProjectStore } from '../../store/projectStore'
import { InputField } from '../shared/InputField'
import { SelectField } from '../shared/SelectField'
import { ValidationBadge, fieldResults } from '../shared/ValidationBadge'
import { validateLine } from '../../utils/validation'
import type { ConveyorLineConfig, FeedMode } from '../../types'

interface Props { line: ConveyorLineConfig }

const FEED_MODE_OPTIONS: { value: FeedMode; label: string }[] = [
  { value: 'horizontal', label: 'Horizontal (side-by-side)' },
  { value: 'vertical',   label: 'Vertical (end-to-end)'    },
  { value: 'random',     label: 'Random mix'               },
]

export function FeedConfigPanel({ line }: Props) {
  const updateFeed = useConfigStore(s => s.updateFeed)
  const unitSystem = useProjectStore(s => s.unitSystem)
  const validationResults = validateLine(line, unitSystem)

  const f = line.feed

  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="text-sm font-semibold text-gray-800">Feed</h3>

      <SelectField
        label="Feed Mode"
        value={f.mode}
        options={FEED_MODE_OPTIONS}
        onChange={v => updateFeed(line.id, { mode: v as FeedMode })}
      />

      <InputField
        label="Target Feed Rate"
        value={f.targetPPM}
        onChange={v => updateFeed(line.id, { targetPPM: v as number })}
        unit="PPM"
        min={1}
        max={3000}
        step={5}
      />
      <ValidationBadge results={fieldResults(validationResults, 'feed.targetPPM')} />

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">
          Scan Read Rate
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.5}
            max={1}
            step={0.01}
            value={f.scanReadRate}
            onChange={e => updateFeed(line.id, { scanReadRate: parseFloat(e.target.value) })}
            className="flex-1"
          />
          <span className="w-14 text-right text-sm tabular-nums">
            {(f.scanReadRate * 100).toFixed(0)}%
          </span>
        </div>
        <p className="text-xs text-gray-400">Fraction of barcodes successfully read</p>
      </div>

      <InputField
        label="PLC Latency"
        value={f.plcLatencyMs}
        onChange={v => updateFeed(line.id, { plcLatencyMs: v as number })}
        unit="ms"
        min={1}
        max={500}
        step={1}
      />
      <ValidationBadge results={fieldResults(validationResults, 'feed.plcLatencyMs')} />

      <div className="flex flex-col gap-2">
        {(
          [
            ['Mixed Dimensions',   'mixedDimensions', 'Products vary in size within a run'] ,
            ['Singulated',         'singulated',       'One product at a time on infeed'    ],
            ['Metered Feed',       'metered',          'Feed rate actively controlled by PLC'],
          ] as [string, keyof typeof f, string][]
        ).map(([label, key, hint]) => (
          <label key={key} className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={f[key] as boolean}
              onChange={e => updateFeed(line.id, { [key]: e.target.checked })}
              className="mt-0.5 rounded"
            />
            <span className="flex flex-col">
              <span className="text-sm text-gray-700">{label}</span>
              <span className="text-xs text-gray-400">{hint}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/config/FeedConfigPanel.tsx
git commit -m "feat: add FeedConfigPanel"
```

---

### Task 13: ConfigSidebar + LinesTabs

**Files:**
- Create: `src/components/config/ConfigSidebar.tsx`
- Create: `src/components/project/LinesTabs.tsx`

- [ ] **Step 1: Create `LinesTabs.tsx`**

```tsx
// src/components/project/LinesTabs.tsx
import { useState } from 'react'
import { useConfigStore } from '../../store/configStore'

export function LinesTabs() {
  const { lines, activeLineId, setActiveLineId, addLine, removeLine, renameLine, duplicateLine } =
    useConfigStore(s => ({
      lines:          s.lines,
      activeLineId:   s.activeLineId,
      setActiveLineId: s.setActiveLineId,
      addLine:        s.addLine,
      removeLine:     s.removeLine,
      renameLine:     s.renameLine,
      duplicateLine:  s.duplicateLine,
    }))

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  function startEdit(id: string, name: string) {
    setEditingId(id)
    setEditValue(name)
  }

  function commitEdit() {
    if (editingId && editValue.trim()) {
      renameLine(editingId, editValue.trim())
    }
    setEditingId(null)
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200 bg-white px-3 py-1">
      {lines.map(line => (
        <div
          key={line.id}
          className={`group flex shrink-0 items-center gap-1 rounded-t px-3 py-1.5 text-sm cursor-pointer select-none ${
            activeLineId === line.id
              ? 'border-b-2 border-blue-600 font-medium text-blue-700'
              : 'text-gray-500 hover:text-gray-800'
          }`}
          onClick={() => setActiveLineId(line.id)}
        >
          {editingId === line.id ? (
            <input
              autoFocus
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit() }}
              className="w-24 rounded border border-blue-300 px-1 text-sm focus:outline-none"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span onDoubleClick={e => { e.stopPropagation(); startEdit(line.id, line.name) }}>
              {line.name}
            </span>
          )}

          {/* Context menu buttons — visible on hover */}
          <span
            className="hidden group-hover:flex items-center gap-0.5 ml-1"
            onClick={e => e.stopPropagation()}
          >
            <button
              title="Rename"
              onClick={() => startEdit(line.id, line.name)}
              className="rounded p-0.5 text-gray-400 hover:text-gray-600"
            >
              ✎
            </button>
            <button
              title="Duplicate"
              onClick={() => duplicateLine(line.id)}
              className="rounded p-0.5 text-gray-400 hover:text-gray-600"
            >
              ⎘
            </button>
            {lines.length > 1 && (
              <button
                title="Delete"
                onClick={() => removeLine(line.id)}
                className="rounded p-0.5 text-red-300 hover:text-red-500"
              >
                ✕
              </button>
            )}
          </span>
        </div>
      ))}

      <button
        onClick={addLine}
        className="shrink-0 rounded px-2 py-1 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        title="Add line"
      >
        +
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create `ConfigSidebar.tsx`**

```tsx
// src/components/config/ConfigSidebar.tsx
import { useState } from 'react'
import { useConfigStore } from '../../store/configStore'
import { ConveyorConfigPanel } from './ConveyorConfigPanel'
import { ExitConfigPanel } from './ExitConfigPanel'
import { ProductConfigPanel } from './ProductConfigPanel'
import { FeedConfigPanel } from './FeedConfigPanel'
import { validateLine } from '../../utils/validation'
import { useProjectStore } from '../../store/projectStore'

type Tab = 'conveyor' | 'exits' | 'products' | 'feed'

const TABS: { id: Tab; label: string }[] = [
  { id: 'conveyor',  label: '① Belt'     },
  { id: 'exits',     label: '② Exits'    },
  { id: 'products',  label: '③ Products' },
  { id: 'feed',      label: '④ Feed'     },
]

export function ConfigSidebar() {
  const [activeTab, setActiveTab] = useState<Tab>('conveyor')

  const { lines, activeLineId, isDirty, saveLoading, saveVersion } = useConfigStore(s => ({
    lines:       s.lines,
    activeLineId: s.activeLineId,
    isDirty:     s.isDirty,
    saveLoading: s.saveLoading,
    saveVersion: s.saveVersion,
  }))
  const unitSystem = useProjectStore(s => s.unitSystem)

  const line = lines.find(l => l.id === activeLineId)

  if (!line) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-gray-400">
        No line selected.
      </div>
    )
  }

  const validationResults = validateLine(line, unitSystem)
  const criticalCount = validationResults.filter(r => r.severity === 'critical').length
  const warningCount  = validationResults.filter(r => r.severity === 'warning').length

  return (
    <div className="flex h-full flex-col">
      {/* Validation summary bar */}
      {(criticalCount > 0 || warningCount > 0) && (
        <div className="flex items-center gap-2 border-b border-gray-200 bg-amber-50 px-3 py-1.5 text-xs">
          {criticalCount > 0 && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-700">
              {criticalCount} error{criticalCount > 1 ? 's' : ''}
            </span>
          )}
          {warningCount > 0 && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700">
              {warningCount} warning{warningCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-white">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-600 text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'conveyor'  && <ConveyorConfigPanel line={line} />}
        {activeTab === 'exits'     && <ExitConfigPanel     line={line} />}
        {activeTab === 'products'  && <ProductConfigPanel  line={line} />}
        {activeTab === 'feed'      && <FeedConfigPanel     line={line} />}
      </div>

      {/* Save button */}
      <div className="border-t border-gray-200 bg-white p-3">
        <button
          onClick={() => saveVersion()}
          disabled={!isDirty || saveLoading || criticalCount > 0}
          className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {saveLoading
            ? 'Saving…'
            : isDirty
              ? criticalCount > 0
                ? `Fix ${criticalCount} error${criticalCount > 1 ? 's' : ''} before saving`
                : 'Save Version'
              : 'Saved ✓'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/config/ConfigSidebar.tsx src/components/project/LinesTabs.tsx
git commit -m "feat: add ConfigSidebar (tabbed panels) and LinesTabs"
```

---

### Task 14: VersionHistory

**Files:**
- Create: `src/components/project/VersionHistory.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/project/VersionHistory.tsx
import { useState } from 'react'
import { useConfigStore } from '../../store/configStore'
import type { ProjectVersion } from '../../types'

export function VersionHistory() {
  const [collapsed, setCollapsed] = useState(false)
  const [labelInput, setLabelInput] = useState('')

  const { versions, versionsLoading, saveLoading, isDirty, saveVersion, restoreVersion } =
    useConfigStore(s => ({
      versions:       s.versions,
      versionsLoading: s.versionsLoading,
      saveLoading:    s.saveLoading,
      isDirty:        s.isDirty,
      saveVersion:    s.saveVersion,
      restoreVersion: s.restoreVersion,
    }))

  async function handleSave() {
    await saveVersion(labelInput.trim() || undefined)
    setLabelInput('')
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className={`flex flex-col border-l border-gray-200 bg-white transition-all ${collapsed ? 'w-8' : 'w-64'}`}>
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex h-10 items-center justify-center border-b border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
        title={collapsed ? 'Expand version history' : 'Collapse'}
      >
        {collapsed ? '◁' : '▷'}
      </button>

      {!collapsed && (
        <>
          <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
            <span className="text-xs font-semibold text-gray-700">Version History</span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
              {versions.length}
            </span>
          </div>

          {/* Save with label */}
          <div className="flex gap-1 border-b border-gray-200 p-2">
            <input
              type="text"
              placeholder="Label (optional)"
              value={labelInput}
              onChange={e => setLabelInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
            <button
              onClick={handleSave}
              disabled={saveLoading}
              className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saveLoading ? '…' : 'Save'}
            </button>
          </div>

          {/* Version list */}
          <div className="flex-1 overflow-y-auto">
            {versionsLoading && (
              <p className="py-4 text-center text-xs text-gray-400">Loading…</p>
            )}
            {!versionsLoading && versions.length === 0 && (
              <p className="py-4 text-center text-xs text-gray-400">No saved versions yet.</p>
            )}
            {versions.map(v => (
              <VersionRow key={v.id} version={v} onRestore={restoreVersion} formatDate={formatDate} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function VersionRow({
  version,
  onRestore,
  formatDate,
}: {
  version: ProjectVersion
  onRestore: (v: ProjectVersion) => void
  formatDate: (iso: string) => string
}) {
  return (
    <div className="group flex items-start justify-between gap-1 border-b border-gray-100 px-3 py-2 hover:bg-gray-50">
      <div className="flex flex-col">
        <span className="text-xs font-medium text-gray-700">
          v{version.version_num}
          {version.label && (
            <span className="ml-1 font-normal text-gray-500">— {version.label}</span>
          )}
        </span>
        <span className="text-xs text-gray-400">{formatDate(version.created_at)}</span>
      </div>
      <button
        onClick={() => onRestore(version)}
        className="shrink-0 rounded px-1.5 py-0.5 text-xs text-blue-600 opacity-0 group-hover:opacity-100 hover:bg-blue-50"
      >
        Restore
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/project/VersionHistory.tsx
git commit -m "feat: add VersionHistory sidebar"
```

---

### Task 15: Wire everything in ProjectWorkspace + update UnitToggle

**Files:**
- Modify: `src/components/project/ProjectWorkspace.tsx`
- Modify: `src/components/shared/UnitToggle.tsx`

- [ ] **Step 1: Update `UnitToggle.tsx` to also convert config values**

Read the current file first, then replace with:

```tsx
// src/components/shared/UnitToggle.tsx
import { useProjectStore } from '../../store/projectStore'
import { useConfigStore } from '../../store/configStore'
import type { UnitSystem } from '../../types'

export function UnitToggle() {
  const unitSystem    = useProjectStore(s => s.unitSystem)
  const setUnitSystem = useProjectStore(s => s.setUnitSystem)
  const convertToSystem = useConfigStore(s => s.convertToSystem)

  function handleToggle(system: UnitSystem) {
    setUnitSystem(system)
    // Convert any loaded config values in-place
    const { projectId } = useConfigStore.getState()
    if (projectId) convertToSystem(system)
  }

  return (
    <div className="flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 text-xs font-medium">
      {(['imperial', 'metric'] as UnitSystem[]).map(sys => (
        <button
          key={sys}
          onClick={() => handleToggle(sys)}
          className={`rounded px-2.5 py-1 capitalize transition-colors ${
            unitSystem === sys
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {sys === 'imperial' ? 'Imperial' : 'Metric'}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Replace `ProjectWorkspace.tsx`**

```tsx
// src/components/project/ProjectWorkspace.tsx
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Header } from '../shared/Header'
import { LinesTabs } from './LinesTabs'
import { ConfigSidebar } from '../config/ConfigSidebar'
import { VersionHistory } from './VersionHistory'
import { useConfigStore } from '../../store/configStore'
import { useProjectStore } from '../../store/projectStore'

export function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>()
  const loadConfig   = useConfigStore(s => s.loadConfig)
  const configLoading = useConfigStore(s => s.configLoading)
  const projects     = useProjectStore(s => s.projects)
  const unitSystem   = useProjectStore(s => s.unitSystem)

  // Resolve project metadata from cached project list
  const project = projects.find(p => p.id === id)

  useEffect(() => {
    if (!id) return
    const name   = project?.name       ?? 'Untitled Project'
    const system = project?.unit_system ?? unitSystem
    loadConfig(id, name, system)
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

      {/* Main area below header */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Config sidebar (320px) */}
        <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white">
          <ConfigSidebar />
        </aside>

        {/* Centre: Lines tabs + canvas + KPI placeholder */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <LinesTabs />

          {/* Canvas area — Stage 3 placeholder */}
          <div className="flex flex-1 items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="text-4xl text-gray-300">⚙</div>
              <p className="mt-2 text-sm font-medium text-gray-400">
                Simulation Canvas
              </p>
              <p className="text-xs text-gray-300">Coming in Stage 3</p>
            </div>
          </div>

          {/* KPI strip — Stage 4 placeholder */}
          <div className="flex h-24 items-center justify-center border-t border-gray-200 bg-white">
            <p className="text-xs text-gray-300">KPI Dashboard — Stage 4</p>
          </div>
        </div>

        {/* Right: Version history (collapsible) */}
        <VersionHistory />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles and all tests pass**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: 0 TypeScript errors, all tests pass.

- [ ] **Step 4: Run the dev server and smoke-test manually**

```bash
npm run dev
```

Open http://localhost:5173, sign in, open a project, and verify:
- [ ] Config sidebar shows 4 tabs (Belt, Exits, Products, Feed)
- [ ] Line tabs: add a line, rename by double-click, delete
- [ ] Conveyor panel: changing speed updates the gap time hint
- [ ] Exits panel: add an exit, change diverter type → cycle/extend/retract times auto-fill
- [ ] Products panel: add 2 SKUs totalling ≠ 100% → red distribution warning appears
- [ ] Feed panel: set target PPM very high → critical error on the Save button
- [ ] Save button: disabled when there are critical errors; saves successfully otherwise
- [ ] Version history panel: after save, v1 appears; clicking Restore loads config
- [ ] Unit toggle: switching metric converts belt speed from ft/min to m/min

- [ ] **Step 5: Commit and push**

```bash
git add src/components/project/ProjectWorkspace.tsx src/components/shared/UnitToggle.tsx
git commit -m "feat: wire ProjectWorkspace with ConfigSidebar, LinesTabs, VersionHistory"
git push
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| All config panels (Conveyor, Exits, Diverters, Products, Feed) | Tasks 9–12 (diverters embedded in ExitConfigPanel) |
| Diverter presets auto-populated per type | Task 4 + Task 10 (`applyPreset`) |
| Validation badges red/amber/blue updating live | Tasks 5, 8 |
| Multi-line tabs (add/rename/duplicate/delete) | Task 13 (LinesTabs) |
| Save config to Supabase (project_versions) | Tasks 6, 7, 14 |
| Version history sidebar (load/restore/label) | Task 14 |
| Numeric inputs with inline units + min/max | Task 8 (InputField) |
| Imperial ↔ metric conversion of existing values | Tasks 2, 6, 15 |

### Type consistency check

- `ConveyorLineConfig.exits` uses `ExitConfig` — ✓ used consistently in Tasks 5, 6, 9–13
- `gapTimeSec` signature `(minGapDistanceIn, beltSpeedFpm)` — called correctly in Task 9 with imperial conversion before the call
- `validateLine(line, unitSystem)` — called with both args in Tasks 5, 9–13
- `convertLineConfig` from Task 2 imported and called correctly in Task 6 `convertToSystem`
- `ProjectConfig.projectId` (not `id`) — used consistently in Tasks 1, 6
- `presetMidpoint` from Task 4 called correctly in Task 10

### No placeholders confirmed

All tasks contain complete, runnable code. No "TBD" or "similar to above" patterns.
