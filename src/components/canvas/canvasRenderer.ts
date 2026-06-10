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
