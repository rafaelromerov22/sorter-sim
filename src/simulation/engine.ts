import type { SimInput, SimRunResult, SimPackage, JamEvent, ExitSimStats, PackageOutcome } from './types'
import { createRng } from './seededRng'
import { pickSKU } from './packageFactory'
import { theoreticalMaxFeedPPM } from '../utils/throughputCalc'

const MAX_PACKAGES = 5_000
const RUN_DURATION_SEC = 300

export function runSimulation(input: SimInput): SimRunResult {
  const { beltSpeedFpm, minGapIn, targetPPM, scanReadRate, plcLatencyMs, availabilityFactor } = input
  const rng = createRng(input.randomSeed)
  const intervalSec = 60 / targetPPM

  // Theoretical max uses the longest SKU
  const longestSkuLengthFt = input.skus.length > 0
    ? Math.max(...input.skus.map(s => s.lengthIn)) / 12
    : 1
  const theoreticalMax = theoreticalMaxFeedPPM(beltSpeedFpm, longestSkuLengthFt, minGapIn / 12)

  // Per-exit state
  const diverterAvailableAt: Record<string, number> = {}
  const laneQueue: Record<string, number[]> = {}
  const exitProcessed: Record<string, number> = {}
  const exitJamCount: Record<string, number> = {}
  const exitOverflowCount: Record<string, number> = {}
  input.exits.forEach(e => {
    diverterAvailableAt[e.id] = 0
    laneQueue[e.id] = []
    exitProcessed[e.id] = 0
    exitJamCount[e.id] = 0
    exitOverflowCount[e.id] = 0
  })

  const packages: SimPackage[] = []
  const jamEvents: JamEvent[] = []
  let noReadCount = 0
  let recirculationCount = 0
  let completedCount = 0
  let jamCount = 0
  let overflowCount = 0

  for (let i = 0; i < MAX_PACKAGES; i++) {
    const infeedTimeSec = i * intervalSec
    if (infeedTimeSec > RUN_DURATION_SEC) break

    // Availability: skip slot if machine is down
    if (rng() > availabilityFactor) continue

    const hasSKUs = input.skus.length > 0
    const sku = hasSKUs ? pickSKU(input.skus, rng) : null
    const scanSuccess = rng() < scanReadRate

    // Assign exit
    let assignedExitId: string | null = null
    if (scanSuccess && sku) {
      assignedExitId = sku.assignedExitId
    }
    if (!scanSuccess || !assignedExitId) {
      if (!scanSuccess) noReadCount++
      if (input.noReadExitId) {
        assignedExitId = input.noReadExitId
      } else if (input.recirculationEnabled) {
        recirculationCount++
        packages.push({
          id: i, skuId: sku?.id ?? '', skuName: sku?.name ?? 'Unknown',
          lengthFt: (sku?.lengthIn ?? 12) / 12,
          infeedTimeSec, scanSuccess, assignedExitId: null,
          arrivalAtDiverterSec: null, outcome: 'recirculated',
        })
        continue
      }
    }

    // Determine outcome
    let outcome: PackageOutcome = 'no_read'
    let arrivalAtDiverterSec: number | null = null

    if (!assignedExitId) {
      if (scanSuccess) noReadCount++ // scan succeeded but SKU had no assigned exit
      outcome = 'no_read'
    } else {
      const exit = input.exits.find(e => e.id === assignedExitId)
      if (!exit) {
        outcome = 'no_read'
      } else {
        const beltSpeedFps = beltSpeedFpm / 60
        const travelSec = exit.distanceFromInfeedFt / beltSpeedFps
        arrivalAtDiverterSec = infeedTimeSec + travelSec + plcLatencyMs / 1000

        // Check diverter availability
        if (arrivalAtDiverterSec < diverterAvailableAt[exit.id]) {
          outcome = 'jammed'
          jamCount++
          exitJamCount[exit.id]++
          if (jamEvents.length < 100) {
            const gapAvail = arrivalAtDiverterSec -
              (diverterAvailableAt[exit.id] - exit.diverterCycleTimeSec)
            jamEvents.push({
              timeSec: arrivalAtDiverterSec,
              exitId: exit.id,
              exitIndex: exit.index,
              packageId: i,
              gapAvailableSec: Math.max(0, gapAvail),
              gapRequiredSec: exit.diverterCycleTimeSec,
            })
          }
        } else {
          // Check lane queue — remove stale entries and check capacity
          const queue = laneQueue[exit.id]
          const pruned = queue.filter(t => t > arrivalAtDiverterSec)
          laneQueue[exit.id] = pruned

          if (pruned.length >= exit.maxQueueDepth) {
            outcome = 'overflow'
            overflowCount++
            exitOverflowCount[exit.id]++
          } else {
            outcome = 'diverted'
            completedCount++
            exitProcessed[exit.id]++
            diverterAvailableAt[exit.id] = arrivalAtDiverterSec + exit.diverterCycleTimeSec

            // Schedule lane departure
            const packageLengthFt = (sku?.lengthIn ?? 12) / 12
            const laneClearSec = packageLengthFt / (exit.laneExitSpeedFpm / 60)
            const lastDep = pruned.length > 0 ? pruned[pruned.length - 1] : arrivalAtDiverterSec
            laneQueue[exit.id].push(Math.max(lastDep, arrivalAtDiverterSec) + laneClearSec)
          }
        }
      }
    }

    packages.push({
      id: i,
      skuId: sku?.id ?? '',
      skuName: sku?.name ?? 'Unknown',
      lengthFt: (sku?.lengthIn ?? 12) / 12,
      infeedTimeSec,
      scanSuccess,
      assignedExitId,
      arrivalAtDiverterSec,
      outcome,
    })
  }

  const actualRunSec = packages.length > 0
    ? packages[packages.length - 1].infeedTimeSec + intervalSec
    : RUN_DURATION_SEC
  const runMinutes = actualRunSec / 60
  const actualPPM = runMinutes > 0 ? completedCount / runMinutes : 0
  const efficiencyPercent = theoreticalMax > 0 ? (actualPPM / theoreticalMax) * 100 : 0

  const exitStats: ExitSimStats[] = input.exits.map(e => ({
    exitId: e.id,
    exitIndex: e.index,
    packagesProcessed: exitProcessed[e.id],
    packagesPerMin: runMinutes > 0 ? exitProcessed[e.id] / runMinutes : 0,
    jamCount: exitJamCount[e.id],
    queueOverflows: exitOverflowCount[e.id],
  }))

  return {
    runDurationSec: actualRunSec,
    totalPackages: packages.length,
    completedPackages: completedCount,
    jamCount,
    noReadCount,
    recirculationCount,
    overflowCount,
    actualPPM,
    theoreticalMaxPPM: theoreticalMax,
    efficiencyPercent,
    exitStats,
    jamEvents,
    packages,
  }
}
