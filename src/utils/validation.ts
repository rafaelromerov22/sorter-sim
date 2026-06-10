// src/utils/validation.ts
import type { ConveyorLineConfig, ValidationResult, UnitSystem } from '../types'
import { DIVERTER_PRESETS } from '../constants/diverterPresets'
import { achievablePPM } from './throughputCalc'
import { mmToIn, mToFt, mpmToFpm } from './unitConverter'

/**
 * Convert a value in the active unit system to imperial inches (for product dimensions)
 */
function toImperialIn(v: number, system: UnitSystem): number {
  return system === 'metric' ? mmToIn(v) : v
}
function toImperialFt(v: number, system: UnitSystem): number {
  return system === 'metric' ? mToFt(v) : v
}
function toImperialFpm(v: number, system: UnitSystem): number {
  return system === 'metric' ? mpmToFpm(v) : v
}

export function validateLine(
  line: ConveyorLineConfig,
  unitSystem: UnitSystem,
): ValidationResult[] {
  const results: ValidationResult[] = []

  const beltSpeedFpm = toImperialFpm(line.conveyor.speed, unitSystem)
  const minGapIn     = toImperialIn(line.conveyor.minGapDistance, unitSystem)
  const minGapFt     = minGapIn / 12

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

    // CRITICAL: SKUs assigned to this exit that are too short for the diverter
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
        message: `Belt speed ${beltSpeedFpm.toFixed(0)} ft/min exceeds ${preset.label} recommended maximum of ${preset.maxBeltSpeed} ft/min.`,
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
