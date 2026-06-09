import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../../lib/supabaseClient'

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Sorter Conveyor Simulator
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to access your projects
          </p>
        </div>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]}
          redirectTo={window.location.origin + '/dashboard'}
          showLinks={true}
          view="sign_in"
        />
      </div>
    </div>
  )
}
