import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'
import type { Project, UnitSystem } from '../types'

interface ProjectStore {
  projects: Project[]
  loading: boolean
  error: string | null
  unitSystem: UnitSystem

  // Synchronous setters (also used directly in tests)
  setProjects: (projects: Project[]) => void
  removeProject: (id: string) => void
  setUnitSystem: (system: UnitSystem) => void

  // Async Supabase actions
  fetchProjects: () => Promise<void>
  createProject: (name: string, description?: string) => Promise<Project | null>
  deleteProject: (id: string) => Promise<void>
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  loading: false,
  error: null,
  unitSystem: 'imperial',

  setProjects: (projects) => set({ projects }),

  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
    })),

  setUnitSystem: (unitSystem) => set({ unitSystem }),

  fetchProjects: async () => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) {
      set({ loading: false, error: error.message })
      return
    }
    set({ loading: false, projects: data as Project[] })
  },

  createProject: async (name, description) => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name,
        description: description ?? null,
        unit_system: get().unitSystem,
      })
      .select()
      .single()
    if (error) {
      set({ loading: false, error: error.message })
      return null
    }
    const project = data as Project
    set((state) => ({
      loading: false,
      projects: [project, ...state.projects],
    }))
    return project
  },

  deleteProject: async (id) => {
    // Optimistic update: remove immediately, restore on error
    const previous = get().projects
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
    }))
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
    if (error) {
      set({ projects: previous, error: error.message })
    }
  },
}))
