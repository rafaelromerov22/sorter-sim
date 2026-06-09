import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthGuard } from './AuthGuard'

const { mockGetSession, mockOnAuthStateChange } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
}))

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}))

function renderGuard(sessionValue: unknown) {
  mockGetSession.mockResolvedValue({ data: { session: sessionValue }, error: null })
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route
          path="/protected"
          element={
            <AuthGuard>
              <div>Protected Content</div>
            </AuthGuard>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading spinner while session is being checked', () => {
    // getSession never resolves — simulates loading state
    mockGetSession.mockReturnValue(new Promise(() => {}))
    render(
      <MemoryRouter>
        <AuthGuard><div>Content</div></AuthGuard>
      </MemoryRouter>
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders children when a session exists', async () => {
    renderGuard({ user: { id: 'user-1', email: 'user@example.com' } })
    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    })
  })

  it('redirects to /login when session is null', async () => {
    renderGuard(null)
    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument()
    })
  })
})
