import type { ConveyorLineConfig, UnitSystem } from '../types'
import type { SimInput, SimExit, SimSKU } from './types'
import { mToFt, mmToIn, mpmToFpm, kgToLbs } from '../utils/unitConverter'

export function toSimInput(line: ConveyorLineConfig, unitSystem: UnitSystem): SimInput {
  const m = unitSystem === 'metric'

  const exits: SimExit[] = line.exits.map(e => ({
    id: e.id,
    index: e.index,
    distanceFromInfeedFt: m ? mToFt(e.distanceFromInfeed) : e.distanceFromInfeed / 12,
    diverterCycleTimeSec: e.diverterCycleTime,
    maxQueueDepth: e.maxQueueDepth,
    laneExitSpeedFpm: m ? mpmToFpm(e.exitSpeed) : e.exitSpeed / 12,
    laneLengthFt: m ? mToFt(e.laneLength) : e.laneLength / 12,
  }))

  const skus: SimSKU[] = line.skus.map(sk => ({
    id: sk.id,
    name: sk.name,
    lengthIn: m ? mmToIn(sk.length) : sk.length,
    weightLbs: m ? kgToLbs(sk.weight) : sk.weight,
    distributionPercent: sk.distributionPercent,
    assignedExitId: sk.assignedExitId,
  }))

  return {
    beltSpeedFpm: m ? mpmToFpm(line.conveyor.speed) : line.conveyor.speed / 12,
    beltLengthFt: m ? mToFt(line.conveyor.length) : line.conveyor.length / 12,
    minGapIn: m ? mmToIn(line.conveyor.minGapDistance) : line.conveyor.minGapDistance,
    availabilityFactor: line.conveyor.availabilityFactor,
    targetPPM: line.feed.targetPPM,
    scanReadRate: line.feed.scanReadRate,
    plcLatencyMs: line.feed.plcLatencyMs,
    recirculationEnabled: line.recirculationEnabled,
    recirculationDelaySec: line.recirculationDelaySec,
    noReadExitId: line.noReadExitId,
    randomSeed: line.randomSeed,
    exits,
    skus,
  }
}
