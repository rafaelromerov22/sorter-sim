import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

type AuthView = 'sign_in' | 'sign_up' | 'forgot_password'

export function LoginPage() {
  const [view, setView] = useState<AuthView>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (view === 'sign_in') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      // AuthGuard will handle redirect on successful sign-in
    } else if (view === 'sign_up') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setMessage('Account created! Check your email to confirm, then sign in.')
        setView('sign_in')
      }
    } else if (view === 'forgot_password') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/dashboard',
      })
      if (error) {
        setError(error.message)
      } else {
        setMessage('Password reset email sent. Check your inbox.')
      }
    }

    setLoading(false)
  }

  const titles: Record<AuthView, string> = {
    sign_in: 'Sign in',
    sign_up: 'Create account',
    forgot_password: 'Reset password',
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Sorter Conveyor Simulator</h1>
          <p className="mt-1 text-sm text-gray-500">{titles[view]}</p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {view !== 'forgot_password' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {loading ? 'Please wait…' : titles[view]}
          </button>
        </form>

        {/* Links */}
        <div className="mt-4 space-y-2 text-center text-sm">
          {view === 'sign_in' && (
            <>
              <button
                onClick={() => { setView('forgot_password'); setError(null); setMessage(null) }}
                className="block w-full text-gray-500 hover:text-gray-700"
              >
                Forgot your password?
              </button>
              <button
                onClick={() => { setView('sign_up'); setError(null); setMessage(null) }}
                className="block w-full text-blue-600 hover:text-blue-700 font-medium"
              >
                Don't have an account? Sign up
              </button>
            </>
          )}
          {(view === 'sign_up' || view === 'forgot_password') && (
            <button
              onClick={() => { setView('sign_in'); setError(null); setMessage(null) }}
              className="block w-full text-blue-600 hover:text-blue-700 font-medium"
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
