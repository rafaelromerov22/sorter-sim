// src/store/configStore.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Supabase before importing the store
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  },
}))

import { useConfigStore } from './configStore'

describe('configStore', () => {
  beforeEach(() => {
    useConfigStore.setState(useConfigStore.getState().getInitialState())
  })

  it('initial state has no lines and no projectId', () => {
    const { projectId, lines } = useConfigStore.getState()
    expect(projectId).toBeNull()
    expect(lines).toHaveLength(0)
  })

  it('addLine: adds a line with default values', () => {
    useConfigStore.getState().addLine()
    const { lines } = useConfigStore.getState()
    expect(lines).toHaveLength(1)
    expect(lines[0].name).toBe('Line 1')
    expect(lines[0].conveyor.speed).toBe(200)
  })

  it('addLine twice: names are Line 1 and Line 2', () => {
    useConfigStore.getState().addLine()
    useConfigStore.getState().addLine()
    const { lines } = useConfigStore.getState()
    expect(lines[0].name).toBe('Line 1')
    expect(lines[1].name).toBe('Line 2')
  })

  it('removeLine: removes the correct line', () => {
    useConfigStore.getState().addLine()
    useConfigStore.getState().addLine()
    const { lines } = useConfigStore.getState()
    const idToRemove = lines[0].id
    useConfigStore.getState().removeLine(idToRemove)
    expect(useConfigStore.getState().lines).toHaveLength(1)
    expect(useConfigStore.getState().lines[0].id).not.toBe(idToRemove)
  })

  it('renameLine: updates the line name', () => {
    useConfigStore.getState().addLine()
    const id = useConfigStore.getState().lines[0].id
    useConfigStore.getState().renameLine(id, 'Zone A')
    expect(useConfigStore.getState().lines[0].name).toBe('Zone A')
  })

  it('updateConveyor: updates a specific conveyor field', () => {
    useConfigStore.getState().addLine()
    const id = useConfigStore.getState().lines[0].id
    useConfigStore.getState().updateConveyor(id, { speed: 350 })
    expect(useConfigStore.getState().lines[0].conveyor.speed).toBe(350)
  })

  it('addExit / removeExit round-trip', () => {
    useConfigStore.getState().addLine()
    const lineId = useConfigStore.getState().lines[0].id
    useConfigStore.getState().addExit(lineId)
    expect(useConfigStore.getState().lines[0].exits).toHaveLength(1)
    const exitId = useConfigStore.getState().lines[0].exits[0].id
    useConfigStore.getState().removeExit(lineId, exitId)
    expect(useConfigStore.getState().lines[0].exits).toHaveLength(0)
  })

  it('addSKU / removeSKU round-trip', () => {
    useConfigStore.getState().addLine()
    const lineId = useConfigStore.getState().lines[0].id
    useConfigStore.getState().addSKU(lineId)
    expect(useConfigStore.getState().lines[0].skus).toHaveLength(1)
    const skuId = useConfigStore.getState().lines[0].skus[0].id
    useConfigStore.getState().removeSKU(lineId, skuId)
    expect(useConfigStore.getState().lines[0].skus).toHaveLength(0)
  })

  it('convertToSystem: converts conveyor speed from imperial to metric', () => {
    useConfigStore.setState({ unitSystem: 'imperial' })
    useConfigStore.getState().addLine()
    const originalSpeed = useConfigStore.getState().lines[0].conveyor.speed // 200 ft/min
    useConfigStore.getState().convertToSystem('metric')
    const newSpeed = useConfigStore.getState().lines[0].conveyor.speed
    expect(newSpeed).toBeCloseTo(originalSpeed * 0.3048, 4)
  })

  it('setIsDirty: marks store as dirty', () => {
    expect(useConfigStore.getState().isDirty).toBe(false)
    useConfigStore.getState().setIsDirty(true)
    expect(useConfigStore.getState().isDirty).toBe(true)
  })
})
