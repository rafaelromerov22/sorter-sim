import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useProjectStore } from './projectStore'
import type { Project } from '../types'

// Mock Supabase so tests never hit the network
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}))

const mockProject: Project = {
  id: 'test-id-1',
  owner_id: 'user-1',
  name: 'Test Project',
  description: null,
  unit_system: 'imperial',
  created_at: '2026-06-09T00:00:00Z',
  updated_at: '2026-06-09T00:00:00Z',
}

describe('useProjectStore', () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [],
      loading: false,
      error: null,
      unitSystem: 'imperial',
    })
  })

  it('initializes with empty projects and imperial units', () => {
    const { result } = renderHook(() => useProjectStore())
    expect(result.current.projects).toEqual([])
    expect(result.current.unitSystem).toBe('imperial')
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('setUnitSystem switches to metric', () => {
    const { result } = renderHook(() => useProjectStore())
    act(() => { result.current.setUnitSystem('metric') })
    expect(result.current.unitSystem).toBe('metric')
  })

  it('setUnitSystem switches back to imperial', () => {
    useProjectStore.setState({ unitSystem: 'metric' })
    const { result } = renderHook(() => useProjectStore())
    act(() => { result.current.setUnitSystem('imperial') })
    expect(result.current.unitSystem).toBe('imperial')
  })

  it('setProjects replaces the projects array', () => {
    const { result } = renderHook(() => useProjectStore())
    act(() => { result.current.setProjects([mockProject]) })
    expect(result.current.projects).toHaveLength(1)
    expect(result.current.projects[0].name).toBe('Test Project')
  })

  it('setProjects with empty array clears projects', () => {
    useProjectStore.setState({ projects: [mockProject] })
    const { result } = renderHook(() => useProjectStore())
    act(() => { result.current.setProjects([]) })
    expect(result.current.projects).toHaveLength(0)
  })

  it('removeProject removes the matching project by id', () => {
    useProjectStore.setState({ projects: [mockProject] })
    const { result } = renderHook(() => useProjectStore())
    act(() => { result.current.removeProject('test-id-1') })
    expect(result.current.projects).toHaveLength(0)
  })

  it('removeProject does nothing when id not found', () => {
    useProjectStore.setState({ projects: [mockProject] })
    const { result } = renderHook(() => useProjectStore())
    act(() => { result.current.removeProject('nonexistent-id') })
    expect(result.current.projects).toHaveLength(1)
  })
})
