// src/components/canvas/canvasRenderer.ts
import type { ExitSide, DivertAngle } from '../../types'
import type { SimPackage } from '../../simulation/types'
import { packageBeltXFt, isOnBelt, isInExitLane } from './canvasGeometry'

export interface CanvasExit {
  id: string
  side: ExitSide
  angle: DivertAngle
  distanceFromInfeedFt: number
  laneWidthFt: number
  laneLengthFt: number
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
  const color = OUTCOME_COLORS[pkg.outcome] ?? sku?.color ?? '#3b82f6'

  const exitXPx = exit.distanceFromInfeedFt * scale
  const originY = exit.side === 'left' ? beltTop : beltBottom
  const angleRad = (exit.angle * Math.PI) / 180
  const canvasAngle = exit.side === 'right' ? angleRad : -angleRad

  const pkgLenPx = Math.max(2, beltDimFt(pkg, sku) * scale)
  const pkgWPx   = Math.max(2, crossDimFt(pkg, sku) * scale)
  const GAP_PX = 2

  // Sum the actual rendered lengths of all packages that arrived before this one
  const priorPkgs = packages.filter(p =>
    p.assignedExitId === pkg.assignedExitId &&
    p.outcome === 'diverted' &&
    p.arrivalAtDiverterSec !== null &&
    p.arrivalAtDiverterSec < (pkg.arrivalAtDiverterSec ?? Infinity) &&
    simTime >= p.arrivalAtDiverterSec,
  )
  const offsetPx = priorPkgs.reduce((sum, p) => {
    const ps = skuMap.get(p.skuId)
    return sum + Math.max(2, beltDimFt(p, ps) * scale) + GAP_PX
  }, 0)

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
