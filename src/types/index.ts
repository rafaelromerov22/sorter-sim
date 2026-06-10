// src/types/index.ts

// ── Unit system ──────────────────────────────────────────────────────────────
export type UnitSystem = 'imperial' | 'metric'

// ── Supabase table shapes ────────────────────────────────────────────────────
export interface Project {
  id: string
  owner_id: string
  name: string
  description: string | null
  unit_system: UnitSystem
  created_at: string
  updated_at: string
}

export interface AuthUser {
  id: string
  email: string | undefined
}

// ── Diverter ─────────────────────────────────────────────────────────────────
export type DiverterType =
  | 'sliding_shoe'
  | 'pop_up_roller'
  | 'arm_pusher'
  | 'mdr_module'
  | 'powered_roller'

export interface DiverterPreset {
  type: DiverterType
  label: string
  cycleTimeRange: [number, number]   // seconds [min, max]
  extendTimeRange: [number, number]
  retractTimeRange: [number, number]
  minProductLength: number           // inches (imperial canonical)
  maxProductWeight: number           // lbs (imperial canonical)
  maxCyclesPerHour: number
  maxBeltSpeed: number               // ft/min (imperial canonical)
  notes: string
}

// ── Config building blocks ───────────────────────────────────────────────────
export type ExitSide = 'left' | 'right'
export type DivertAngle = 30 | 45 | 90
export type FeedMode = 'horizontal' | 'vertical' | 'random'
export type PackagingType = 'rigid_carton' | 'poly_bag' | 'tote' | 'loose_item'
export type ProductOrientation = 'long_axis_parallel' | 'long_axis_perpendicular'
export type ValidationSeverity = 'critical' | 'warning' | 'info'

export interface ConveyorConfig {
  length: number             // ft | m
  width: number              // ft | m
  speed: number              // ft/min | m/min
  minGapDistance: number     // in | mm  (minGapTime is derived in UI)
  availabilityFactor: number // 0.0–1.0
  encoderResolution: number  // pulses per ft | m
}

export interface ExitConfig {
  id: string
  index: number
  side: ExitSide
  distanceFromInfeed: number  // ft | m
  laneWidth: number           // ft | m
  laneLength: number          // ft | m
  exitSpeed: number           // ft/min | m/min
  maxQueueDepth: number       // products
  angle: DivertAngle
  diverterType: DiverterType
  diverterCycleTime: number   // seconds
  diverterExtendTime: number  // seconds
  diverterRetractTime: number // seconds
  sensorOffset: number        // ft | m (distance upstream from divert centre)
  priority: number
}

export interface ProductSKU {
  id: string
  name: string
  length: number              // in | mm
  width: number               // in | mm
  height: number              // in | mm
  weight: number              // lbs | kg
  orientation: ProductOrientation
  packagingType: PackagingType
  cogHeight: number           // in | mm (centre-of-gravity height)
  distributionPercent: number // all SKUs must sum to 100
  assignedExitId: string | null
  color: string               // hex  e.g. '#3b82f6'
}

export interface FeedConfig {
  mode: FeedMode
  targetPPM: number
  mixedDimensions: boolean
  singulated: boolean
  metered: boolean
  scanReadRate: number   // 0.0–1.0
  plcLatencyMs: number
}

export interface ConveyorLineConfig {
  id: string
  name: string
  conveyor: ConveyorConfig
  exits: ExitConfig[]
  feed: FeedConfig
  skus: ProductSKU[]
  recirculationEnabled: boolean
  recirculationDelaySec: number
  noReadExitId: string | null
  randomSeed: number
}

export interface ProjectConfig {
  projectId: string
  projectName: string
  unitSystem: UnitSystem
  lines: ConveyorLineConfig[]
}

// ── Supabase project_versions row ────────────────────────────────────────────
export interface ProjectVersion {
  id: string
  project_id: string
  version_num: number
  label: string | null
  config_json: ProjectConfig
  results_json: unknown | null
  created_at: string
  created_by: string
}

// ── Validation ───────────────────────────────────────────────────────────────
export interface ValidationResult {
  severity: ValidationSeverity
  field: string   // dot-notation path e.g. 'feed.targetPPM' or 'exits[0].diverterType'
  message: string
}
