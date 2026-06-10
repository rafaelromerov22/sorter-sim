// src/store/configStore.ts
import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'
import { useProjectStore } from './projectStore'
import type {
  ConveyorConfig, ConveyorLineConfig, ExitConfig, FeedConfig,
  ProductSKU, ProjectConfig, ProjectVersion, UnitSystem,
} from '../types'
import { convertLineConfig } from '../utils/unitConverter'
import { runSimulation } from '../simulation/engine'
import { toSimInput } from '../simulation/configAdapter'
import type { SimulationResults } from '../types'
import type { SimRunResult } from '../simulation/types'

// ── Default factory functions ─────────────────────────────────────────────────
function defaultConveyorConfig(): ConveyorConfig {
  return {
    length: 100, width: 3, speed: 200,
    minGapDistance: 6, availabilityFactor: 0.88, encoderResolution: 100,
  }
}

function defaultFeedConfig(): FeedConfig {
  return {
    mode: 'horizontal', targetPPM: 30, mixedDimensions: false,
    singulated: true, metered: true, scanReadRate: 0.99, plcLatencyMs: 10,
  }
}

function defaultExit(index: number): ExitConfig {
  return {
    id: crypto.randomUUID(),
    index,
    side: 'right',
    distanceFromInfeed: 20 * (index + 1),
    laneWidth: 3,
    laneLength: 10,
    exitSpeed: 150,
    maxQueueDepth: 10,
    angle: 45,
    diverterType: 'sliding_shoe',
    diverterCycleTime: 0.45,
    diverterExtendTime: 0.225,
    diverterRetractTime: 0.225,
    sensorOffset: 2,
    priority: index,
  }
}

const SKU_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#6366f1',
]

function defaultSKU(index: number): ProductSKU {
  return {
    id: crypto.randomUUID(),
    name: `SKU ${index + 1}`,
    length: 12, width: 8, height: 6, weight: 5,
    orientation: 'long_axis_parallel',
    packagingType: 'rigid_carton',
    cogHeight: 3,
    distributionPercent: 100,
    assignedExitId: null,
    color: SKU_COLORS[index % SKU_COLORS.length],
  }
}

function defaultLine(index: number): ConveyorLineConfig {
  return {
    id: crypto.randomUUID(),
    name: `Line ${index + 1}`,
    conveyor: defaultConveyorConfig(),
    exits: [],
    feed: defaultFeedConfig(),
    skus: [],
    recirculationEnabled: false,
    recirculationDelaySec: 30,
    noReadExitId: null,
    randomSeed: Math.floor(Math.random() * 1_000_000),
  }
}

// ── Store interface ───────────────────────────────────────────────────────────
interface ConfigStore {
  projectId: string | null
  projectName: string
  unitSystem: UnitSystem
  lines: ConveyorLineConfig[]
  activeLineId: string | null
  isDirty: boolean
  versions: ProjectVersion[]
  versionsLoading: boolean
  saveLoading: boolean
  configLoading: boolean
  error: string | null

  // Expose for test reset
  getInitialState: () => Partial<ConfigStore>

  // Sync actions
  setActiveLineId: (id: string) => void
  addLine: () => void
  removeLine: (id: string) => void
  renameLine: (id: string, name: string) => void
  duplicateLine: (id: string) => void
  updateConveyor: (lineId: string, partial: Partial<ConveyorConfig>) => void
  updateFeed: (lineId: string, partial: Partial<FeedConfig>) => void
  addExit: (lineId: string) => void
  updateExit: (lineId: string, exitId: string, partial: Partial<ExitConfig>) => void
  removeExit: (lineId: string, exitId: string) => void
  addSKU: (lineId: string) => void
  updateSKU: (lineId: string, skuId: string, partial: Partial<ProductSKU>) => void
  removeSKU: (lineId: string, skuId: string) => void
  convertToSystem: (target: UnitSystem) => void
  setIsDirty: (dirty: boolean) => void

  // Async Supabase actions
  loadConfig: (projectId: string, projectName: string, unitSystem: UnitSystem) => Promise<void>
  saveVersion: (label?: string) => Promise<void>
  fetchVersions: () => Promise<void>
  restoreVersion: (version: ProjectVersion) => void

  // Simulation
  simResults: SimulationResults | null
  simFullResult: SimRunResult | null
  simLoading: boolean
  runSimulation: () => Promise<void>
  saveSimResults: () => Promise<void>
}

const INITIAL_STATE = {
  projectId: null,
  projectName: '',
  unitSystem: 'imperial' as UnitSystem,
  lines: [] as ConveyorLineConfig[],
  activeLineId: null,
  isDirty: false,
  versions: [] as ProjectVersion[],
  versionsLoading: false,
  saveLoading: false,
  configLoading: false,
  error: null,
  simResults: null,
  simFullResult: null,
  simLoading: false,
}

// Helper: update a single line in the array by id
function mapLine(
  lines: ConveyorLineConfig[],
  lineId: string,
  fn: (l: ConveyorLineConfig) => ConveyorLineConfig,
): ConveyorLineConfig[] {
  return lines.map(l => l.id === lineId ? fn(l) : l)
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  ...INITIAL_STATE,

  getInitialState: () => INITIAL_STATE,

  setActiveLineId: (id) => set({ activeLineId: id }),

  addLine: () => {
    const index = get().lines.length
    const line = defaultLine(index)
    set(s => ({
      lines: [...s.lines, line],
      activeLineId: s.activeLineId ?? line.id,
      isDirty: true,
    }))
  },

  removeLine: (id) => {
    const remaining = get().lines.filter(l => l.id !== id)
    set({
      lines: remaining,
      activeLineId: remaining[0]?.id ?? null,
      isDirty: true,
    })
  },

  renameLine: (id, name) => set(s => ({
    lines: mapLine(s.lines, id, l => ({ ...l, name })),
    isDirty: true,
  })),

  duplicateLine: (id) => {
    const source = get().lines.find(l => l.id === id)
    if (!source) return
    const copy: ConveyorLineConfig = {
      ...JSON.parse(JSON.stringify(source)),
      id: crypto.randomUUID(),
      name: source.name + ' (copy)',
    }
    set(s => ({ lines: [...s.lines, copy], activeLineId: copy.id, isDirty: true }))
  },

  updateConveyor: (lineId, partial) => set(s => ({
    lines: mapLine(s.lines, lineId, l => ({ ...l, conveyor: { ...l.conveyor, ...partial } })),
    isDirty: true,
  })),

  updateFeed: (lineId, partial) => set(s => ({
    lines: mapLine(s.lines, lineId, l => ({ ...l, feed: { ...l.feed, ...partial } })),
    isDirty: true,
  })),

  addExit: (lineId) => set(s => ({
    lines: mapLine(s.lines, lineId, l => ({
      ...l,
      exits: [...l.exits, defaultExit(l.exits.length)],
    })),
    isDirty: true,
  })),

  updateExit: (lineId, exitId, partial) => set(s => ({
    lines: mapLine(s.lines, lineId, l => ({
      ...l,
      exits: l.exits.map(e => e.id === exitId ? { ...e, ...partial } : e),
    })),
    isDirty: true,
  })),

  removeExit: (lineId, exitId) => set(s => ({
    lines: mapLine(s.lines, lineId, l => ({
      ...l,
      exits: l.exits.filter(e => e.id !== exitId),
    })),
    isDirty: true,
  })),

  addSKU: (lineId) => set(s => ({
    lines: mapLine(s.lines, lineId, l => ({
      ...l,
      skus: [...l.skus, defaultSKU(l.skus.length)],
    })),
    isDirty: true,
  })),

  updateSKU: (lineId, skuId, partial) => set(s => ({
    lines: mapLine(s.lines, lineId, l => ({
      ...l,
      skus: l.skus.map(sk => sk.id === skuId ? { ...sk, ...partial } : sk),
    })),
    isDirty: true,
  })),

  removeSKU: (lineId, skuId) => set(s => ({
    lines: mapLine(s.lines, lineId, l => ({
      ...l,
      skus: l.skus.filter(sk => sk.id !== skuId),
    })),
    isDirty: true,
  })),

  convertToSystem: (target) => {
    const current = get().unitSystem
    if (current === target) return
    set(s => ({
      unitSystem: target,
      lines: s.lines.map(l => convertLineConfig(l, current, target)),
      isDirty: true,
    }))
  },

  setIsDirty: (dirty) => set({ isDirty: dirty }),

  // ── Supabase async ──────────────────────────────────────────────────────────
  loadConfig: async (projectId, projectName, unitSystem) => {
    set({ configLoading: true, error: null, projectId, projectName, unitSystem })
    const { data, error } = await supabase
      .from('project_versions')
      .select('*')
      .eq('project_id', projectId)
      .order('version_num', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      set({ configLoading: false, error: error.message })
      return
    }
    if (!data) {
      // No version yet — start with one default line
      const line = defaultLine(0)
      set({ configLoading: false, lines: [line], activeLineId: line.id, isDirty: false, versions: [] })
      return
    }
    const config = (data as ProjectVersion).config_json
    const storedUnitSystem: UnitSystem = config.unitSystem ?? 'imperial'
    useProjectStore.getState().setUnitSystem(storedUnitSystem)
    set({
      configLoading: false,
      unitSystem: storedUnitSystem,
      lines: config.lines,
      activeLineId: config.lines[0]?.id ?? null,
      isDirty: false,
    })
    get().fetchVersions()
  },

  saveVersion: async (label) => {
    const { projectId, projectName, unitSystem, lines } = get()
    if (!projectId) return
    set({ saveLoading: true, error: null })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { set({ saveLoading: false, error: 'Not authenticated' }); return }
      const config: ProjectConfig = { projectId, projectName, unitSystem, lines }
      const { error } = await supabase
        .from('project_versions')
        .insert({ project_id: projectId, label: label ?? null, config_json: config, created_by: user.id })
      if (error) { set({ saveLoading: false, error: error.message }); return }
      set({ saveLoading: false, isDirty: false })
      get().fetchVersions()
    } catch (e) {
      set({ saveLoading: false, error: e instanceof Error ? e.message : 'Save failed' })
    }
  },

  fetchVersions: async () => {
    const { projectId } = get()
    if (!projectId) return
    set({ versionsLoading: true })
    try {
      const { data, error } = await supabase
        .from('project_versions')
        .select('id, project_id, version_num, label, created_at, created_by')
        .eq('project_id', projectId)
        .order('version_num', { ascending: false })
      if (!error && data) {
        set({ versions: data as ProjectVersion[], versionsLoading: false })
      } else {
        set({ versionsLoading: false })
      }
    } catch (e) {
      set({ versionsLoading: false, error: e instanceof Error ? e.message : 'Fetch failed' })
    }
  },

  restoreVersion: (version) => {
    const config = version.config_json
    set({
      lines: config.lines,
      activeLineId: config.lines[0]?.id ?? null,
      isDirty: true,
    })
  },

  runSimulation: async () => {
    const { lines, activeLineId, unitSystem } = get()
    const line = lines.find(l => l.id === activeLineId)
    if (!line) return
    set({ simLoading: true, simResults: null, simFullResult: null })
    try {
      const input = toSimInput(line, unitSystem)
      const full = runSimulation(input)
      const summary: SimulationResults = {
        runDurationSec:     full.runDurationSec,
        totalPackages:      full.totalPackages,
        completedPackages:  full.completedPackages,
        jamCount:           full.jamCount,
        noReadCount:        full.noReadCount,
        unroutedCount:      full.unroutedCount,
        recirculationCount: full.recirculationCount,
        overflowCount:      full.overflowCount,
        actualPPM:          full.actualPPM,
        theoreticalMaxPPM:  full.theoreticalMaxPPM,
        efficiencyPercent:  full.efficiencyPercent,
        exitStats: full.exitStats.map(e => ({
          exitId:            e.exitId,
          exitIndex:         e.exitIndex,
          packagesProcessed: e.packagesProcessed,
          packagesPerMin:    e.packagesPerMin,
          jamCount:          e.jamCount,
          queueOverflows:    e.queueOverflows,
        })),
        jamEvents: full.jamEvents.slice(0, 20),
      }
      set({ simLoading: false, simResults: summary, simFullResult: full })
    } catch (e) {
      set({ simLoading: false, error: e instanceof Error ? e.message : 'Simulation failed' })
    }
  },

  saveSimResults: async () => {
    const { projectId, simResults } = get()
    if (!projectId || !simResults) return
    try {
      const { data: latest } = await supabase
        .from('project_versions')
        .select('id')
        .eq('project_id', projectId)
        .order('version_num', { ascending: false })
        .limit(1)
        .single()
      if (!latest) return
      await supabase
        .from('project_versions')
        .update({ results_json: simResults })
        .eq('id', latest.id)
    } catch {
      // Non-fatal — results still displayed in UI
    }
  },
}))
