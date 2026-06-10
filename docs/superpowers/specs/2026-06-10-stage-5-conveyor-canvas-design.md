# Stage 5: Visual Conveyor Canvas — Design Spec

## Overview

Add a post-run animated replay canvas to the Sorter Conveyor Simulator. After running a simulation, the user can switch to a "Canvas" tab and watch packages flow down the belt, divert into exits, jam, or drop off as no-reads — all drawn to scale as SKU-colored rectangles.

**Rendering:** HTML Canvas + `requestAnimationFrame` (no extra dependencies).
**Animation model:** post-run replay — the engine batch-runs instantly as today, then the canvas scrubs through the recorded package data.

---

## Layout & Integration

The canvas lives in a new **"Canvas" tab** in `ProjectWorkspace`, alongside the existing Config / Products / Simulation tabs. The tab is disabled (grayed out) until `simResults` is non-null.

The view is a **top-down perspective** of the conveyor:

- Infeed on the left, belt end on the right
- Belt is centered vertically in the canvas
- Exits branch off the belt at their configured `distanceFromInfeed`, `side` (top = left, bottom = right), and `angle` (30°/45°/90°)
- All dimensions drawn to scale: `px = valueFt × scale`, where `scale = canvasWidth / beltLengthFt`

---

## Data Model Changes

`SimulationResults` (in `src/types/index.ts`) gains a `packages` field:

```ts
packages: Array<{
  id: number
  skuId: string
  lengthFt: number
  widthFt: number          // derived from SKU width at mapping time
  infeedTimeSec: number
  arrivalAtDiverterSec: number | null
  assignedExitId: string | null
  outcome: 'diverted' | 'jammed' | 'no_read' | 'recirculated' | 'overflow'
}>
```

`configStore.ts` maps `SimRunResult.packages` into this field when storing results. `SimPackage` already has all required fields except `widthFt`, which is looked up from the SKU at mapping time.

Storage impact: ~100 packages × ~100 bytes ≈ 10 KB per run. Negligible.

---

## Component Structure

### `src/components/canvas/canvasRenderer.ts`

Pure drawing module — no React, no state. Exports:

```ts
export interface RenderFrame {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  simTime: number
  config: ConveyorLineConfig
  packages: SimulationResults['packages']
  scale: number   // px per ft
}

export function renderFrame(f: RenderFrame): void
```

Internal draw order (painter's algorithm):

1. **Belt** — filled rect, full width × `beltWidthFt × scale` px, centered vertically. Light gray fill (#f3f4f6), dark border (#d1d5db).
2. **Exit lanes** — for each exit: a dashed-border rectangle at `distanceFromInfeed` on the belt edge, extending at the configured angle (30°/45°/90°) for `laneLength` ft, `laneWidth` ft wide.
3. **Packages on belt** — visible when `infeedTimeSec <= simTime < arrivalAtDiverterSec` (or belt-end time for non-diverted). Position: `x = (simTime - pkg.infeedTimeSec) × beltSpeedFps`. Colored by SKU color; jammed → red (#ef4444); no_read/unrouted → gray (#9ca3af).
4. **Packages in lanes** — visible when `simTime >= arrivalAtDiverterSec` and outcome is `diverted`. Drawn inside the exit lane, stacked from diverter inward.

### `src/components/canvas/ConveyorCanvas.tsx`

React component. Local state only — no new Zustand store.

```tsx
export function ConveyorCanvas()
```

- Reads `simResults` and active line config from `configStore` via `useShallow`
- `canvasRef: RefObject<HTMLCanvasElement>`
- Local state: `simTime: number`, `playing: boolean`, `speed: 1 | 2 | 5 | 10`
- `useEffect` runs the `requestAnimationFrame` loop; cleans up on unmount or when `playing` changes
- On each frame: advance `simTime += elapsed × speed`, call `renderFrame`, update scrubber
- When `simTime >= runDurationSec`: stop playback

**Toolbar (above canvas):**

| Control | Detail |
|---|---|
| Play/Pause | ▶ / ⏸ button |
| Speed | 1× · 2× · 5× · 10× pill buttons, active one highlighted |
| Scrubber | `<input type="range">` 0–runDurationSec; dragging pauses and seeks |
| Time display | `t = 45.2s / 300.0s` right-aligned |

When playback ends, scrubber sits at end. Clicking ▶ resets to t=0 and replays.

### `src/components/project/ProjectWorkspace.tsx`

- Add "Canvas" tab to the tab list; disabled when `simResults === null`
- Render `<ConveyorCanvas />` when Canvas tab is active

---

## Coordinate System

```
canvasWidth  = element clientWidth (responsive)
canvasHeight = beltWidthFt × scale + margin for exits
scale        = canvasWidth / beltLengthFt

beltTop      = (canvasHeight / 2) - (beltWidthPx / 2)
beltBottom   = beltTop + beltWidthPx

package x    = (simTime - pkg.infeedTimeSec) × beltSpeedFps × scale
package y    = beltTop + (beltWidthPx / 2) - (pkgWidthPx / 2)  // centered on belt
```

**Exit lane transform:**

```
exitX  = exit.distanceFromInfeedFt × scale
exitY  = side === 'left' ? beltTop : beltBottom

// Rotate canvas context by exit angle, draw rect, restore
ctx.save()
ctx.translate(exitX, exitY)
ctx.rotate(side === 'left' ? -angleRad : angleRad)
ctx.strokeRect(0, 0, laneLengthPx, laneWidthPx)
ctx.restore()
```

---

## Package Coloring

| State | Color |
|---|---|
| On belt, outcome = diverted | SKU color (from `config.skus`) |
| On belt, outcome = jammed | #ef4444 (red) |
| On belt, outcome = no_read / unrouted | #9ca3af (gray) |
| In exit lane | SKU color, 70% opacity |
| Recirculated / overflow | #9ca3af (gray), fades out at belt end |

---

## Testing

`canvasRenderer.ts` is pure and testable. Tests cover:

- Package on-belt position calculation at various `simTime` values
- Package not rendered before `infeedTimeSec`
- Package not rendered after it clears the belt
- Diverted package switches to lane position at `arrivalAtDiverterSec`
- Scale calculation from belt length and canvas width

`ConveyorCanvas.tsx` — no unit tests (animation loop + canvas context); covered by visual inspection.

---

## Files Created / Modified

| File | Action |
|---|---|
| `src/types/index.ts` | Add `packages` array to `SimulationResults` |
| `src/simulation/types.ts` | No change (SimPackage already has all fields) |
| `src/store/configStore.ts` | Map `packages` from SimRunResult into SimulationResults |
| `src/components/canvas/canvasRenderer.ts` | Create — pure drawing functions |
| `src/components/canvas/canvasRenderer.test.ts` | Create — unit tests |
| `src/components/canvas/ConveyorCanvas.tsx` | Create — animated replay component |
| `src/components/project/ProjectWorkspace.tsx` | Add Canvas tab |
