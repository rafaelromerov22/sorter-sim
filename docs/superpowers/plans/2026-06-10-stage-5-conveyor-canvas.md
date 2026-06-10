# Stage 5: Visual Conveyor Canvas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a post-run animated replay canvas that shows packages flowing down the conveyor belt and diverting into exits — drawn to scale as SKU-colored rectangles.

**Architecture:** HTML Canvas + `requestAnimationFrame` for the animation loop; pure geometry utilities handle position math; `ConveyorCanvas` reads `simFullResult` (already stored in `configStore`) and the active line config directly — no new store needed. A "Results | Canvas" tab toggle in `ProjectWorkspace` switches between the existing `SimResults` view and the new canvas.

**Tech Stack:** React 19, TypeScript, HTML Canvas 2D API, Zustand (`useShallow`), Tailwind CSS v4, Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/components/canvas/canvasGeometry.ts` | Create | Pure position math — no canvas, no React |
| `src/components/canvas/canvasGeometry.test.ts` | Create | Unit tests for geometry functions |
| `src/components/canvas/canvasRenderer.ts` | Create | Imperative draw-one-frame function |
| `src/components/canvas/ConveyorCanvas.tsx` | Create | React component: toolbar + rAF loop + canvas element |
| `src/components/project/ProjectWorkspace.tsx` | Modify | Add Results/Canvas tab toggle, render ConveyorCanvas |

---

## Task 1: Canvas geometry utilities + tests

**Files:**
- Create: `src/components/canvas/canvasGeometry.ts`
- Create: `src/components/canvas/canvasGeometry.test.ts`

Pure functions that answer "where is this package at time t?" — no canvas context, no React, fully testable.

- [ ] **Step 1: Create `canvasGeometry.ts`**

```ts
// src/components/canvas/canvasGeometry.ts
import type { SimPackage } from '../../simulation/types'

/**
 * X position of a package's leading edge along the belt in feet.
 * Returns null if the package has not yet entered the belt.
 */
export function packageBeltXFt(
  pkg: SimPackage,
  simTime: number,
  beltSpeedFpm: number,
): number | null {
  if (simTime < pkg.infeedTimeSec) return null
  return (simTime - pkg.infeedTimeSec) * (beltSpeedFpm / 60)
}

/**
 * True while a package is travelling on the main belt surface.
 * A package leaves the belt when it arrives at its diverter OR its
 * leading edge exits the far end of the belt.
 */
export function isOnBelt(
  pkg: SimPackage,
  simTime: number,
  beltLengthFt: number,
  beltSpeedFpm: number,
): boolean {
  const x = packageBeltXFt(pkg, simTime, beltSpeedFpm)
  if (x === null) return false
  if (pkg.arrivalAtDiverterSec !== null && simTime >= pkg.arrivalAtDiverterSec) return false
  return x < beltLengthFt
}

/**
 * True when a diverted package should be shown inside its exit lane.
 */
export function isInExitLane(pkg: SimPackage, simTime: number): boolean {
  return (
    pkg.outcome === 'diverted' &&
    pkg.arrivalAtDiverterSec !== null &&
    simTime >= pkg.arrivalAtDiverterSec
  )
}

/**
 * Number of packages already in the same exit lane before `pkg` arrived —
 * used to stack packages from the diverter outward.
 */
export function lanePositionOf(
  pkg: SimPackage,
  packages: SimPackage[],
  simTime: number,
): number {
  if (!isInExitLane(pkg, simTime)) return 0
  return packages.filter(
    p =>
      p.assignedExitId === pkg.assignedExitId &&
      p.outcome === 'diverted' &&
      p.arrivalAtDiverterSec !== null &&
      p.arrivalAtDiverterSec < (pkg.arrivalAtDiverterSec ?? Infinity) &&
      simTime >= p.arrivalAtDiverterSec,
  ).length
}
```

- [ ] **Step 2: Create `canvasGeometry.test.ts`**

```ts
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
    // t=15: between infeed(10) and arrival(20)
    expect(isOnBelt(pkg({ infeedTimeSec: 10, arrivalAtDiverterSec: 20 }), 15, 100, 120)).toBe(true)
  })
  it('false at arrival time (package has diverted)', () => {
    expect(isOnBelt(pkg({ infeedTimeSec: 10, arrivalAtDiverterSec: 20 }), 20, 100, 120)).toBe(false)
  })
  it('false when leading edge exits belt end (no diverter)', () => {
    // 120fpm=2fps; infeed at 0; at t=60 x=120ft > 100ft belt
    expect(isOnBelt(pkg({ infeedTimeSec: 0, arrivalAtDiverterSec: null, outcome: 'no_read' }), 60, 100, 120)).toBe(false)
  })
  it('true for no-read package still within belt length', () => {
    // at t=30: x=60ft < 100ft
    expect(isOnBelt(pkg({ infeedTimeSec: 0, arrivalAtDiverterSec: null, outcome: 'no_read' }), 30, 100, 120)).toBe(true)
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
})
```

- [ ] **Step 3: Run tests — expect all to pass**

```
npx vitest run src/components/canvas/canvasGeometry.test.ts
```

Expected: `11 passed`

- [ ] **Step 4: Commit**

```
git add src/components/canvas/canvasGeometry.ts src/components/canvas/canvasGeometry.test.ts
git commit -m "feat: canvas geometry utilities and tests"
```

---

## Task 2: Canvas renderer

**Files:**
- Create: `src/components/canvas/canvasRenderer.ts`

Imperative draw function — no React, no state. Draws one frame onto an existing 2D context.

Coordinate system:
- `scale = canvasWidth / beltLengthFt` (px per ft)
- Belt is centered vertically: `beltTop = canvasHeight/2 - beltWidthFt*scale/2`
- Package x on belt: `xFt * scale` (from `packageBeltXFt`)
- Package y: centered on belt centerline
- Exit lanes are drawn using `ctx.rotate(angle)` so the lane extends in its divert direction

Divert angles are measured from the belt direction (east):
- 90° → lane goes straight down/up (perpendicular)
- 45° → lane goes diagonally
- 30° → shallow diagonal

For right-side exits: `canvasAngle = divertAngle × (π/180)` (clockwise from east = southward for 90°)
For left-side exits: `canvasAngle = -divertAngle × (π/180)` (counter-clockwise = northward for 90°)

- [ ] **Step 1: Create `canvasRenderer.ts`**

```ts
// src/components/canvas/canvasRenderer.ts
import type { ExitSide, DivertAngle } from '../../types'
import type { SimPackage } from '../../simulation/types'
import { packageBeltXFt, isOnBelt, isInExitLane, lanePositionOf } from './canvasGeometry'

export interface CanvasExit {
  id: string
  side: ExitSide
  angle: DivertAngle
  distanceFromInfeedFt: number
  laneWidthFt: number
  laneLengthFt: number
}

export interface RenderInput {
  ctx: CanvasRenderingContext2D
  canvasWidth: number
  canvasHeight: number
  simTime: number
  beltLengthFt: number
  beltWidthFt: number
  beltSpeedFpm: number
  exits: CanvasExit[]
  skuMap: Map<string, { color: string; widthFt: number }>
  packages: SimPackage[]
}

// Outcome overrides SKU color for failed packages
const OUTCOME_COLORS: Partial<Record<string, string>> = {
  jammed: '#ef4444',
  no_read: '#9ca3af',
  overflow: '#9ca3af',
  recirculated: '#d1d5db',
}

function drawExitLane(
  ctx: CanvasRenderingContext2D,
  exit: CanvasExit,
  scale: number,
  beltTop: number,
  beltBottom: number,
): void {
  const exitXPx = exit.distanceFromInfeedFt * scale
  const originY = exit.side === 'left' ? beltTop : beltBottom
  const angleRad = (exit.angle * Math.PI) / 180
  const canvasAngle = exit.side === 'right' ? angleRad : -angleRad
  const laneLenPx = exit.laneLengthFt * scale
  const laneWPx = exit.laneWidthFt * scale

  ctx.save()
  ctx.translate(exitXPx, originY)
  ctx.rotate(canvasAngle)
  ctx.setLineDash([5, 5])
  ctx.strokeStyle = '#9ca3af'
  ctx.lineWidth = 1
  ctx.strokeRect(0, -laneWPx / 2, laneLenPx, laneWPx)
  ctx.setLineDash([])
  ctx.restore()
}

function drawPackageOnBelt(
  ctx: CanvasRenderingContext2D,
  pkg: SimPackage,
  simTime: number,
  beltSpeedFpm: number,
  scale: number,
  canvasHeight: number,
  skuMap: RenderInput['skuMap'],
): void {
  const xFt = packageBeltXFt(pkg, simTime, beltSpeedFpm)
  if (xFt === null) return
  const sku = skuMap.get(pkg.skuId)
  const pkgWidthFt = sku?.widthFt ?? 0.5
  const color = OUTCOME_COLORS[pkg.outcome] ?? sku?.color ?? '#3b82f6'

  const px = xFt * scale
  const pw = Math.max(2, pkg.lengthFt * scale)
  const ph = Math.max(2, pkgWidthFt * scale)
  const py = canvasHeight / 2 - ph / 2

  ctx.fillStyle = color
  ctx.fillRect(px, py, pw, ph)
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'
  ctx.lineWidth = 1
  ctx.strokeRect(px, py, pw, ph)
}

function drawPackageInLane(
  ctx: CanvasRenderingContext2D,
  pkg: SimPackage,
  packages: SimPackage[],
  simTime: number,
  scale: number,
  beltTop: number,
  beltBottom: number,
  exits: CanvasExit[],
  skuMap: RenderInput['skuMap'],
): void {
  const exit = exits.find(e => e.id === pkg.assignedExitId)
  if (!exit) return
  const sku = skuMap.get(pkg.skuId)
  const color = sku?.color ?? '#3b82f6'
  const pkgWidthFt = sku?.widthFt ?? 0.5
  const posIdx = lanePositionOf(pkg, packages, simTime)

  const exitXPx = exit.distanceFromInfeedFt * scale
  const originY = exit.side === 'left' ? beltTop : beltBottom
  const angleRad = (exit.angle * Math.PI) / 180
  const canvasAngle = exit.side === 'right' ? angleRad : -angleRad

  const pkgLenPx = Math.max(2, pkg.lengthFt * scale)
  const pkgWPx = Math.max(2, pkgWidthFt * scale)
  const GAP_PX = 2
  const offsetPx = posIdx * (pkgLenPx + GAP_PX)

  ctx.save()
  ctx.translate(exitXPx, originY)
  ctx.rotate(canvasAngle)
  ctx.globalAlpha = 0.8
  ctx.fillStyle = color
  ctx.fillRect(offsetPx, -pkgWPx / 2, pkgLenPx, pkgWPx)
  ctx.globalAlpha = 1
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'
  ctx.lineWidth = 1
  ctx.strokeRect(offsetPx, -pkgWPx / 2, pkgLenPx, pkgWPx)
  ctx.restore()
}

export function drawFrame(input: RenderInput): void {
  const {
    ctx, canvasWidth, canvasHeight, simTime,
    beltLengthFt, beltWidthFt, beltSpeedFpm,
    exits, skuMap, packages,
  } = input

  const scale = canvasWidth / beltLengthFt
  const beltH = Math.max(8, beltWidthFt * scale)
  const beltTop = canvasHeight / 2 - beltH / 2
  const beltBottom = beltTop + beltH

  // Clear
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  // Belt surface
  ctx.fillStyle = '#f3f4f6'
  ctx.fillRect(0, beltTop, canvasWidth, beltH)
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = 1
  ctx.strokeRect(0, beltTop, canvasWidth, beltH)

  // Belt centerline guide
  ctx.setLineDash([8, 8])
  ctx.strokeStyle = '#e5e7eb'
  ctx.beginPath()
  ctx.moveTo(0, canvasHeight / 2)
  ctx.lineTo(canvasWidth, canvasHeight / 2)
  ctx.stroke()
  ctx.setLineDash([])

  // Exit lanes (drawn before packages so packages render on top)
  for (const exit of exits) {
    drawExitLane(ctx, exit, scale, beltTop, beltBottom)
  }

  // Packages on belt
  for (const pkg of packages) {
    if (!isOnBelt(pkg, simTime, beltLengthFt, beltSpeedFpm)) continue
    drawPackageOnBelt(ctx, pkg, simTime, beltSpeedFpm, scale, canvasHeight, skuMap)
  }

  // Packages in exit lanes
  for (const pkg of packages) {
    if (!isInExitLane(pkg, simTime)) continue
    drawPackageInLane(ctx, pkg, packages, simTime, scale, beltTop, beltBottom, exits, skuMap)
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```
git add src/components/canvas/canvasRenderer.ts
git commit -m "feat: canvas renderer draw function"
```

---

## Task 3: ConveyorCanvas component

**Files:**
- Create: `src/components/canvas/ConveyorCanvas.tsx`

React component. Owns the `<canvas>` element, animation loop, and playback controls. Reads `simFullResult` and active line config from `configStore`. All unit conversion from config units → feet happens here before passing to the renderer.

`simFullResult` is already stored in `configStore` (set at the same time as `simResults` in `runSimulation`). It contains `packages: SimPackage[]` which is all the canvas needs for replay.

Unit conversion constants:
- Config stores conveyor dimensions in `ft` (imperial) or `m` (metric)
- Config stores SKU dimensions in `in` (imperial) or `mm` (metric)
- Canvas always works in feet

- [ ] **Step 1: Create `ConveyorCanvas.tsx`**

```tsx
// src/components/canvas/ConveyorCanvas.tsx
import { useRef, useEffect, useState, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useConfigStore } from '../../store/configStore'
import { drawFrame } from './canvasRenderer'
import type { CanvasExit } from './canvasRenderer'
import type { UnitSystem, ConveyorLineConfig } from '../../types'

// ── Unit helpers ─────────────────────────────────────────────────────────────
const FT_PER_M   = 3.28084
const FT_PER_IN  = 1 / 12
const FT_PER_MM  = 1 / 304.8

function conveyorToFt(v: number, us: UnitSystem): number {
  return us === 'metric' ? v * FT_PER_M : v
}
function skuDimToFt(v: number, us: UnitSystem): number {
  return us === 'metric' ? v * FT_PER_MM : v * FT_PER_IN
}

function buildSkuMap(line: ConveyorLineConfig, us: UnitSystem) {
  return new Map(
    line.skus.map(sku => [
      sku.id,
      { color: sku.color, widthFt: skuDimToFt(sku.width, us) },
    ]),
  )
}

function buildExits(line: ConveyorLineConfig, us: UnitSystem): CanvasExit[] {
  return line.exits.map(e => ({
    id: e.id,
    side: e.side,
    angle: e.angle,
    distanceFromInfeedFt: conveyorToFt(e.distanceFromInfeed, us),
    laneWidthFt: conveyorToFt(e.laneWidth, us),
    laneLengthFt: conveyorToFt(e.laneLength, us),
  }))
}

// ── Component ────────────────────────────────────────────────────────────────
export function ConveyorCanvas() {
  const { simFullResult, lines, activeLineId, unitSystem } = useConfigStore(
    useShallow(s => ({
      simFullResult: s.simFullResult,
      lines: s.lines,
      activeLineId: s.activeLineId,
      unitSystem: s.unitSystem,
    })),
  )
  const line = lines.find(l => l.id === activeLineId)

  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef       = useRef<number | null>(null)
  const lastTsRef    = useRef<number | null>(null)
  const simTimeRef   = useRef(0)

  const [simTime, setSimTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed]     = useState<1 | 2 | 5 | 10>(1)

  const runDuration = simFullResult?.runDurationSec ?? 0

  // ── Draw one frame ──────────────────────────────────────────────────────────
  const draw = useCallback(
    (t: number) => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container || !simFullResult || !line) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Sync canvas pixel size to container dimensions
      canvas.width  = container.clientWidth
      canvas.height = Math.max(180, container.clientHeight - 56) // 56 = toolbar height

      const beltLengthFt = conveyorToFt(line.conveyor.length, unitSystem)
      const beltWidthFt  = conveyorToFt(line.conveyor.width, unitSystem)
      const beltSpeedFpm = conveyorToFt(line.conveyor.speed, unitSystem)

      drawFrame({
        ctx,
        canvasWidth:  canvas.width,
        canvasHeight: canvas.height,
        simTime: t,
        beltLengthFt,
        beltWidthFt,
        beltSpeedFpm,
        exits:  buildExits(line, unitSystem),
        skuMap: buildSkuMap(line, unitSystem),
        packages: simFullResult.packages,
      })
    },
    [simFullResult, line, unitSystem],
  )

  // Redraw when simTime changes (handles scrubber seek; harmless double-draw during rAF)
  useEffect(() => { draw(simTime) }, [simTime, draw])

  // ── Animation loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }

    const tick = (ts: number) => {
      const elapsed = lastTsRef.current !== null ? (ts - lastTsRef.current) / 1000 : 0
      lastTsRef.current = ts

      const next = Math.min(simTimeRef.current + elapsed * speed, runDuration)
      simTimeRef.current = next
      setSimTime(next)
      draw(next)

      if (next >= runDuration) {
        setPlaying(false)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    lastTsRef.current = null
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing, speed, runDuration, draw])

  // ── Controls ────────────────────────────────────────────────────────────────
  const handlePlayPause = () => {
    if (simTime >= runDuration) {
      simTimeRef.current = 0
      setSimTime(0)
    }
    setPlaying(p => !p)
  }

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value)
    setPlaying(false)
    simTimeRef.current = t
    setSimTime(t)
  }

  if (!simFullResult || !line) return null

  return (
    <div ref={containerRef} className="flex h-full flex-col gap-2 p-4">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-3">
        <button
          onClick={handlePlayPause}
          className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          {playing ? '⏸' : '▶'}
        </button>

        {/* Speed pills */}
        <div className="flex gap-1">
          {([1, 2, 5, 10] as const).map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                speed === s
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>

        {/* Scrubber */}
        <input
          type="range"
          min={0}
          max={runDuration}
          step={0.1}
          value={simTime}
          onChange={handleScrub}
          className="flex-1"
        />

        {/* Time display */}
        <span className="shrink-0 text-xs tabular-nums text-gray-500">
          t&nbsp;=&nbsp;{simTime.toFixed(1)}s&nbsp;/&nbsp;{runDuration.toFixed(0)}s
        </span>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full flex-1 rounded-lg border border-gray-200 bg-white"
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```
git add src/components/canvas/ConveyorCanvas.tsx
git commit -m "feat: ConveyorCanvas animated replay component"
```

---

## Task 4: Wire Canvas tab into ProjectWorkspace

**Files:**
- Modify: `src/components/project/ProjectWorkspace.tsx`

Add a "Results | Canvas" tab toggle that appears in the center area when `simResults` is non-null. Clicking Run resets to the Results tab so the user sees fresh KPIs first.

- [ ] **Step 1: Read the current file**

Open `src/components/project/ProjectWorkspace.tsx` and note the current imports and JSX structure. The center content area currently uses:
```tsx
{simLoading ? (...) : simResults ? (
  <div className="flex-1 overflow-y-auto">
    <SimResults results={simResults} />
  </div>
) : (...)}
```

- [ ] **Step 2: Replace `ProjectWorkspace.tsx` with the updated version**

```tsx
// src/components/project/ProjectWorkspace.tsx
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { Header } from '../shared/Header'
import { LinesTabs } from './LinesTabs'
import { ConfigSidebar } from '../config/ConfigSidebar'
import { VersionHistory } from './VersionHistory'
import { SimResults } from './SimResults'
import { KpiStrip } from './KpiStrip'
import { ConveyorCanvas } from '../canvas/ConveyorCanvas'
import { useConfigStore } from '../../store/configStore'
import { useProjectStore } from '../../store/projectStore'

type CenterTab = 'results' | 'canvas'

export function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>()

  const { loadConfig, configLoading, simResults, simLoading, runSimulation } =
    useConfigStore(useShallow(s => ({
      loadConfig:    s.loadConfig,
      configLoading: s.configLoading,
      simResults:    s.simResults,
      simLoading:    s.simLoading,
      runSimulation: s.runSimulation,
    })))

  const projects   = useProjectStore(s => s.projects)
  const unitSystem = useProjectStore(s => s.unitSystem)
  const project    = projects.find(p => p.id === id)

  const [centerTab, setCenterTab] = useState<CenterTab>('results')

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

  const handleRun = () => {
    setCenterTab('results')
    runSimulation()
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
                onClick={handleRun}
                disabled={simLoading}
                className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {simLoading ? 'Running…' : '▶ Run'}
              </button>
            </div>
          </div>

          {/* Results / Canvas view tabs — only shown when results exist */}
          {simResults && !simLoading && (
            <div className="flex border-b border-gray-200 bg-white px-4">
              {(['results', 'canvas'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setCenterTab(tab)}
                  className={`border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    centerTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'canvas' ? 'Canvas' : 'Results'}
                </button>
              ))}
            </div>
          )}

          {/* Content area */}
          <div className="flex flex-1 overflow-hidden bg-gray-100">
            {simLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-gray-400">Running simulation…</p>
              </div>
            ) : simResults ? (
              centerTab === 'canvas' ? (
                <div className="flex-1 overflow-hidden">
                  <ConveyorCanvas />
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <SimResults results={simResults} />
                </div>
              )
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

          <KpiStrip />
        </div>

        {/* Right: Version history */}
        <VersionHistory />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run full test suite**

```
npx vitest run
```

Expected: all existing tests pass (canvasGeometry tests + all prior tests, 88+ passed)

- [ ] **Step 4: Build check**

```
npm run build
```

Expected: exits 0, no TypeScript errors

- [ ] **Step 5: Commit**

```
git add src/components/project/ProjectWorkspace.tsx
git commit -m "feat: Results/Canvas tab toggle in ProjectWorkspace"
```

- [ ] **Step 6: Push to deploy**

```
git push
```

Vercel will pick up the push and deploy automatically. Verify on the live URL:
1. Open a project, configure at least one exit and one SKU assigned to it
2. Click **▶ Run**
3. Confirm "Results | Canvas" tab bar appears
4. Click **Canvas** — belt, exit lane, and packages should be visible
5. Click ▶ to play — packages animate from infeed to exit
6. Drag the scrubber — canvas jumps to that time
7. Try 2×, 5×, 10× speed buttons
8. Click Canvas tab on a run with no exits — canvas still renders (empty belt)
