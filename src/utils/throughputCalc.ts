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
