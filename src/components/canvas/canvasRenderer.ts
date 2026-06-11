// src/components/canvas/canvasRenderer.ts
import type { ExitSide, DivertAngle, DiverterType } from '../../types'
import type { SimPackage } from '../../simulation/types'
import { packageBeltXFt, isOnBelt } from './canvasGeometry'

export interface CanvasExit {
  id: string
  side: ExitSide
  angle: DivertAngle
  diverterType: DiverterType
  distanceFromInfeedFt: number
  laneWidthFt: number
  laneLengthFt: number
  exitSpeedFpm: number
  diverterCycleTimeSec: number
  diverterExtendTimeSec: number
  diverterRetractTimeSec: number
}

export interface SkuRenderInfo {
  color: string
  lengthFt: number
  widthFt: number
  orientation: 'long_axis_parallel' | 'long_axis_perpendicular'
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
  skuMap: Map<string, SkuRenderInfo>
  packages: SimPackage[]
}

// Belt-direction footprint: length when parallel, width when perpendicular
function beltDimFt(pkg: SimPackage, sku: SkuRenderInfo | undefined): number {
  if (!sku) return pkg.lengthFt
  return sku.orientation === 'long_axis_perpendicular' ? sku.widthFt : sku.lengthFt
}

// Cross-belt footprint: width when parallel, length when perpendicular
function crossDimFt(_pkg: SimPackage, sku: SkuRenderInfo | undefined): number {
  if (!sku) return 0.5
  return sku.orientation === 'long_axis_perpendicular' ? sku.lengthFt : sku.widthFt
}

// Outcome overrides SKU color for failed packages
const OUTCOME_COLORS: Partial<Record<string, string>> = {
  jammed:          '#ef4444',  // red   — diverter jam
  mechanical_jam:  '#f97316',  // orange — mechanical failure
  no_read:         '#9ca3af',
  overflow:        '#9ca3af',
  recirculated:    '#d1d5db',
}

// Returns 0.0 (fully retracted) → 1.0 (fully extended) for the current simTime,
// based on the most recent diverted package arrival at this exit.
function armPhase(exit: CanvasExit, packages: SimPackage[], simTime: number): number {
  // Find the latest package that has arrived at this exit and was diverted
  let lastArrival = -Infinity
  for (const pkg of packages) {
    if (
      pkg.assignedExitId === exit.id &&
      pkg.outcome === 'diverted' &&
      pkg.arrivalAtDiverterSec !== null &&
      pkg.arrivalAtDiverterSec <= simTime
    ) {
      if (pkg.arrivalAtDiverterSec > lastArrival) lastArrival = pkg.arrivalAtDiverterSec
    }
  }
  if (lastArrival === -Infinity) return 0

  const elapsed = simTime - lastArrival
  const { diverterExtendTimeSec: ext, diverterRetractTimeSec: ret, diverterCycleTimeSec: cycle } = exit

  if (elapsed >= cycle) return 0                            // fully retracted
  if (elapsed < ext)    return elapsed / ext                // extending
  return 1 - (elapsed - ext) / ret                         // retracting
}

// Draw a diverter symbol on the belt surface at the exit position.
// Drawn in belt coordinates (no lane rotation) so it always appears flat on the belt.
function drawDiverterSymbol(
  ctx: CanvasRenderingContext2D,
  exit: CanvasExit,
  packages: SimPackage[],
  simTime: number,
  scale: number,
  beltTop: number,
  beltH: number,
): void {
  const x = exit.distanceFromInfeedFt * scale
  const centerY = beltTop + beltH / 2
  const side = exit.side

  ctx.save()

  switch (exit.diverterType) {
    case 'arm_pusher': {
      const t = armPhase(exit, packages, simTime)
      // Pivot: upstream belt edge (top for right exit, bottom for left exit)
      const pivotY = side === 'right' ? beltTop : beltTop + beltH
      // Arm sweeps from 0° (along belt, pointing upstream/downstream) to ~80° across belt
      // In canvas coords (y down): right-side exit arm sweeps downward, left-side upward
      const maxAngle = (Math.PI / 180) * 80
      const angle = t * maxAngle
      const armLen = beltH * 1.05
      const dir = side === 'right' ? 1 : -1     // +1 = down, -1 = up
      // Rotate arm: when t=0 arm is along belt axis (pointing upstream, angle=0 from -x)
      // When t=1 arm is swung across belt
      const tipX = x - Math.cos(angle) * armLen
      const tipY = pivotY + dir * Math.sin(angle) * armLen

      const lw = Math.max(3, beltH * 0.1)
      ctx.strokeStyle = t > 0 ? '#1d4ed8' : '#374151'
      ctx.lineWidth = lw
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x, pivotY)
      ctx.lineTo(tipX, tipY)
      ctx.stroke()
      // Pivot dot
      ctx.fillStyle = t > 0 ? '#1d4ed8' : '#374151'
      ctx.beginPath()
      ctx.arc(x, pivotY, Math.max(3, beltH * 0.07), 0, Math.PI * 2)
      ctx.fill()
      break
    }

    case 'sliding_shoe': {
      // Two diagonal chevron lines across the belt
      const w = Math.max(4, beltH * 0.12)
      const halfH = beltH * 0.35
      const offset = beltH * 0.15 * (side === 'right' ? 1 : -1)
      ctx.strokeStyle = '#6b7280'
      ctx.lineWidth = Math.max(1.5, w * 0.35)
      ctx.lineCap = 'round'
      for (const dx of [-w, w]) {
        ctx.beginPath()
        ctx.moveTo(x + dx + offset, centerY - halfH)
        ctx.lineTo(x + dx - offset, centerY + halfH)
        ctx.stroke()
      }
      break
    }

    case 'pop_up_roller': {
      const r = Math.max(3, beltH * 0.13)
      ctx.fillStyle = '#9ca3af'
      ctx.strokeStyle = '#6b7280'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(x, centerY, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      break
    }

    case 'mdr_module':
    case 'powered_roller': {
      const barW = Math.max(2, beltH * 0.1)
      ctx.fillStyle = '#d1d5db'
      ctx.strokeStyle = '#9ca3af'
      ctx.lineWidth = 1
      ctx.fillRect(x - barW / 2, beltTop, barW, beltH)
      ctx.strokeRect(x - barW / 2, beltTop, barW, beltH)
      break
    }
  }

  ctx.restore()
}

function drawExitLane(
  ctx: CanvasRenderingContext2D,
  exit: CanvasExit,
  scale: number,
  beltTop: number,
  beltBottom: number,
  exitIndex: number,
): void {
  const exitXPx = exit.distanceFromInfeedFt * scale
  const originY = exit.side === 'left' ? beltTop : beltBottom
  const angleRad = (exit.angle * Math.PI) / 180
  const canvasAngle = exit.side === 'right' ? angleRad : -angleRad
  const laneLenPx = exit.laneLengthFt * scale
  const laneWPx = Math.max(12, exit.laneWidthFt * scale)

  ctx.save()
  ctx.translate(exitXPx, originY)
  ctx.rotate(canvasAngle)

  // Lane fill — light blue so it's clearly distinct from the belt
  ctx.fillStyle = '#dbeafe'
  ctx.fillRect(0, -laneWPx / 2, laneLenPx, laneWPx)

  // Lane border
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 1.5
  ctx.strokeRect(0, -laneWPx / 2, laneLenPx, laneWPx)

  // Exit label (E1, E2…) at start of lane
  const fontSize = Math.max(9, Math.min(13, laneWPx * 0.45))
  ctx.fillStyle = '#1d4ed8'
  ctx.font = `bold ${fontSize}px sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(`E${exitIndex + 1}`, 3, 0)

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
  const color = OUTCOME_COLORS[pkg.outcome] ?? sku?.color ?? '#3b82f6'

  const px = xFt * scale
  const pw = Math.max(2, beltDimFt(pkg, sku) * scale)
  const ph = Math.max(2, crossDimFt(pkg, sku) * scale)
  const py = canvasHeight / 2 - ph / 2

  ctx.fillStyle = color
  ctx.fillRect(px, py, pw, ph)
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'
  ctx.lineWidth = 1
  ctx.strokeRect(px, py, pw, ph)
}

// Draw all packages in one exit lane with time-based movement.
// Packages advance at exitSpeedFpm; each package is blocked by the one ahead.
// A package disappears once its tail passes the lane end (operator removed it).
function drawExitLanePackages(
  ctx: CanvasRenderingContext2D,
  exit: CanvasExit,
  packages: SimPackage[],
  simTime: number,
  scale: number,
  beltTop: number,
  beltBottom: number,
  skuMap: RenderInput['skuMap'],
): void {
  // Packages that have arrived at this exit, sorted earliest first (furthest in lane)
  const arrived = packages
    .filter(p =>
      p.assignedExitId === exit.id &&
      p.outcome === 'diverted' &&
      p.arrivalAtDiverterSec !== null &&
      simTime >= p.arrivalAtDiverterSec,
    )
    .sort((a, b) => (a.arrivalAtDiverterSec ?? 0) - (b.arrivalAtDiverterSec ?? 0))

  if (arrived.length === 0) return

  const exitXPx   = exit.distanceFromInfeedFt * scale
  const originY   = exit.side === 'left' ? beltTop : beltBottom
  const angleRad  = (exit.angle * Math.PI) / 180
  const canvasAngle = exit.side === 'right' ? angleRad : -angleRad
  const laneLenPx = exit.laneLengthFt * scale
  const speedPxPerSec = (exit.exitSpeedFpm / 60) * scale
  const GAP_PX = 2

  ctx.save()
  ctx.translate(exitXPx, originY)
  ctx.rotate(canvasAngle)

  // Process from first-arrived (furthest) to last-arrived (closest to belt).
  // blockerTailPx = tail position of the preceding package (the one ahead in the lane).
  // A package's tail cannot advance past (blockerTailPx - gap).
  let blockerTailPx = Infinity

  for (const pkg of arrived) {
    const sku       = skuMap.get(pkg.skuId)
    const pkgLenPx  = Math.max(2, beltDimFt(pkg, sku) * scale)
    const pkgWPx    = Math.max(2, crossDimFt(pkg, sku) * scale)
    const elapsed   = simTime - (pkg.arrivalAtDiverterSec ?? simTime)
    const naturalTailPx = elapsed * speedPxPerSec

    // Clamp: can't run into the package ahead
    const maxTailPx = blockerTailPx === Infinity
      ? naturalTailPx
      : Math.min(naturalTailPx, blockerTailPx - pkgLenPx - GAP_PX)
    const tailPx = Math.max(0, maxTailPx)

    // Package fully past lane end → operator removed it, stop tracking as blocker
    if (tailPx >= laneLenPx) {
      blockerTailPx = Infinity
      continue
    }

    const color = OUTCOME_COLORS[pkg.outcome] ?? sku?.color ?? '#3b82f6'
    ctx.globalAlpha = 0.85
    ctx.fillStyle = color
    ctx.fillRect(tailPx, -pkgWPx / 2, pkgLenPx, pkgWPx)
    ctx.globalAlpha = 1
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'
    ctx.lineWidth = 1
    ctx.strokeRect(tailPx, -pkgWPx / 2, pkgLenPx, pkgWPx)

    blockerTailPx = tailPx
  }

  ctx.restore()
}


export function drawFrame(input: RenderInput): void {
  const {
    ctx, canvasWidth, canvasHeight, simTime,
    beltLengthFt, beltWidthFt, beltSpeedFpm,
    exits, skuMap, packages,
  } = input

  // Scale to fit all exits within the canvas — exits may be positioned past beltLengthFt
  const maxExitFt = exits.length > 0
    ? Math.max(...exits.map(e => e.distanceFromInfeedFt))
    : 0
  const renderLengthFt = Math.max(beltLengthFt, maxExitFt) * 1.08 // 8% right margin
  const scale = canvasWidth / renderLengthFt

  const beltH = Math.max(8, beltWidthFt * scale)
  const beltTop = canvasHeight / 2 - beltH / 2
  const beltBottom = beltTop + beltH
  const beltEndPx = beltLengthFt * scale // physical belt end (may be < canvasWidth)

  // Clear
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  // Belt surface (drawn only to physical belt end)
  ctx.fillStyle = '#f3f4f6'
  ctx.fillRect(0, beltTop, beltEndPx, beltH)
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = 1
  ctx.strokeRect(0, beltTop, beltEndPx, beltH)

  // Belt centerline guide
  ctx.setLineDash([8, 8])
  ctx.strokeStyle = '#e5e7eb'
  ctx.beginPath()
  ctx.moveTo(0, canvasHeight / 2)
  ctx.lineTo(beltEndPx, canvasHeight / 2)
  ctx.stroke()
  ctx.setLineDash([])

  // Exit lanes (drawn before packages so packages render on top)
  for (let i = 0; i < exits.length; i++) {
    drawExitLane(ctx, exits[i], scale, beltTop, beltBottom, i)
  }

  // Diverter symbols on belt surface (on top of belt, below packages)
  for (const exit of exits) {
    drawDiverterSymbol(ctx, exit, packages, simTime, scale, beltTop, beltH)
  }

  // Packages on belt
  for (const pkg of packages) {
    if (!isOnBelt(pkg, simTime, beltLengthFt, beltSpeedFpm)) continue
    drawPackageOnBelt(ctx, pkg, simTime, beltSpeedFpm, scale, canvasHeight, skuMap)
  }

  // Packages in exit lanes — drawn per exit so we can apply advancing movement
  for (const exit of exits) {
    drawExitLanePackages(ctx, exit, packages, simTime, scale, beltTop, beltBottom, skuMap)
  }

  // No-read / unrouted packages that have reached the belt end — stack at right edge
  const endPackages = packages.filter(pkg => {
    if (pkg.outcome !== 'no_read' && pkg.outcome !== 'overflow') return false
    const x = packageBeltXFt(pkg, simTime, beltSpeedFpm)
    return x !== null && x >= beltLengthFt
  })
  const GAP_PX = 2
  let stackOffsetPx = 0
  for (const pkg of endPackages) {
    const sku = skuMap.get(pkg.skuId)
    const pw = Math.max(2, beltDimFt(pkg, sku) * scale)
    const ph = Math.max(2, crossDimFt(pkg, sku) * scale)
    const px = beltEndPx - pw - stackOffsetPx
    const py = canvasHeight / 2 - ph / 2
    ctx.fillStyle = OUTCOME_COLORS[pkg.outcome] ?? '#9ca3af'
    ctx.fillRect(px, py, pw, ph)
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'
    ctx.lineWidth = 1
    ctx.strokeRect(px, py, pw, ph)
    stackOffsetPx += pw + GAP_PX
  }
}
