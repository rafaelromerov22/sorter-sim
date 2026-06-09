// Unit system — used globally throughout the app
export type UnitSystem = 'imperial' | 'metric'

// Project — matches the Supabase `projects` table schema exactly
export interface Project {
  id: string
  owner_id: string
  name: string
  description: string | null
  unit_system: UnitSystem
  created_at: string
  updated_at: string
}

// Minimal auth user shape returned by Supabase
export interface AuthUser {
  id: string
  email: string | undefined
}
