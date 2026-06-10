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

/** Midpoint of a [min, max] range — used to auto-fill timing fields when diverter type changes. */
export function presetMidpoint([min, max]: [number, number]): number {
  return +((min + max) / 2).toFixed(3)
}
