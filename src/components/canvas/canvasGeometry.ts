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
  if (pkg.assignedExitId === null) return 0
  return packages.filter(
    p =>
      p.assignedExitId === pkg.assignedExitId &&
      p.outcome === 'diverted' &&
      p.arrivalAtDiverterSec !== null &&
      p.arrivalAtDiverterSec < (pkg.arrivalAtDiverterSec ?? Infinity) &&
      simTime >= p.arrivalAtDiverterSec,
  ).length
}
