// src/simulation/types.ts

/** All-imperial input consumed by the engine. Created by configAdapter. */
export interface SimInput {
  beltSpeedFpm: number
  beltLengthFt: number
  minGapIn: number
  availabilityFactor: number   // 0–1
  targetPPM: number
  runDurationSec: number
  scanReadRate: number         // 0–1
  plcLatencyMs: number
  recirculationEnabled: boolean
  recirculationDelaySec: number
  noReadExitId: string | null
  randomSeed: number
  exits: SimExit[]
  skus: SimSKU[]
}

export interface SimExit {
  id: string
  index: number
  distanceFromInfeedFt: number
  diverterCycleTimeSec: number
  maxQueueDepth: number
  laneExitSpeedFpm: number
  laneLengthFt: number
}

export interface SimSKU {
  id: string
  name: string
  lengthIn: number
  weightLbs: number
  distributionPercent: number
  assignedExitId: string | null
}

export type PackageOutcome =
  | 'diverted'      // Successfully sorted to an assigned exit lane
  | 'jammed'        // Diverter was still cycling when package arrived
  | 'no_read'       // Scan failed, no no-read exit configured
  | 'recirculated'  // Scan failed, recirculation enabled
  | 'overflow'      // Exit lane queue was at maxQueueDepth

export interface SimPackage {
  id: number
  skuId: string
  skuName: string
  lengthFt: number
  infeedTimeSec: number
  scanSuccess: boolean
  assignedExitId: string | null
  arrivalAtDiverterSec: number | null
  outcome: PackageOutcome
}

export interface JamEvent {
  timeSec: number
  exitId: string
  exitIndex: number
  packageId: number
  gapAvailableSec: number
  gapRequiredSec: number
}

export interface ExitSimStats {
  exitId: string
  exitIndex: number
  packagesProcessed: number
  packagesPerMin: number
  jamCount: number
  queueOverflows: number
}

/** Full in-memory result — includes per-package log. */
export interface SimRunResult {
  runDurationSec: number
  totalPackages: number
  completedPackages: number
  jamCount: number
  noReadCount: number
  unroutedCount: number
  recirculationCount: number
  overflowCount: number
  actualPPM: number
  theoreticalMaxPPM: number
  efficiencyPercent: number
  exitStats: ExitSimStats[]
  jamEvents: JamEvent[]
  packages: SimPackage[]
}
