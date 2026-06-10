import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UnitToggle } from './UnitToggle'
import { useProjectStore } from '../../store/projectStore'

// Mock Supabase (required because projectStore imports it)
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}))

beforeEach(() => {
  useProjectStore.setState({ unitSystem: 'imperial' })
})

describe('UnitToggle', () => {
  it('renders with Imperial label when unit system is imperial', () => {
    render(<UnitToggle />)
    expect(screen.getByText('Imperial')).toBeInTheDocument()
  })

  it('renders with Metric label when unit system is metric', () => {
    useProjectStore.setState({ unitSystem: 'metric' })
    render(<UnitToggle />)
    expect(screen.getByText('Metric')).toBeInTheDocument()
  })

  it('toggles store to metric when clicked while imperial', () => {
    render(<UnitToggle />)
    fireEvent.click(screen.getByRole('button', { name: 'Metric' }))
    expect(useProjectStore.getState().unitSystem).toBe('metric')
  })

  it('toggles store to imperial when clicked while metric', () => {
    useProjectStore.setState({ unitSystem: 'metric' })
    render(<UnitToggle />)
    fireEvent.click(screen.getByRole('button', { name: 'Imperial' }))
    expect(useProjectStore.getState().unitSystem).toBe('imperial')
  })
})
