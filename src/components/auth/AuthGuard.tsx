import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabaseClient'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  // undefined = still loading; null = no session; Session = authenticated
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => { setSession(session) }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div
          role="status"
          aria-label="Loading"
          className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
        />
      </div>
    )
  }

  if (session === null) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
