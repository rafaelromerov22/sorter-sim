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
// Imperial 'length' dimension is inches (not feet)
export const inToM   = (v: number) => v * 0.0254
export const mToIn   = (v: number) => v / 0.0254
export const inpmToMpm = (v: number) => v * 0.0254  // in/min → m/min
export const mpmToInpm = (v: number) => v / 0.0254  // m/min → in/min

// ── Dimension types ──────────────────────────────────────────────────────────
export type Dimension = 'length' | 'speed' | 'weight' | 'smallLength'

export function toMetric(v: number, dim: Dimension): number {
  switch (dim) {
    case 'length':      return inToM(v)        // in → m
    case 'speed':       return inpmToMpm(v)    // in/min → m/min
    case 'weight':      return lbsToKg(v)
    case 'smallLength': return inToMm(v)
  }
}

export function toImperial(v: number, dim: Dimension): number {
  switch (dim) {
    case 'length':      return mToIn(v)        // m → in
    case 'speed':       return mpmToInpm(v)    // m/min → in/min
    case 'weight':      return kgToLbs(v)
    case 'smallLength': return mmToIn(v)
  }
}

export function unitLabel(dim: Dimension, system: UnitSystem): string {
  const map: Record<Dimension, { imperial: string; metric: string }> = {
    length:      { imperial: 'in',     metric: 'm'     },
    speed:       { imperial: 'in/min', metric: 'm/min' },
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
      // availabilityFactor: dimensionless — no conversion
      // TODO: encoderResolution is 'pulses per ft|m' — needs conversion in a future pass
      //       100 pulses/ft → 328 pulses/m when switching to metric
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
      length:    cv(s.length,    'smallLength'),
      width:     cv(s.width,     'smallLength'),
      height:    cv(s.height,    'smallLength'),
      weight:    cv(s.weight,    'weight'),
      cogHeight: cv(s.cogHeight, 'smallLength'),
    })),
  }
}
