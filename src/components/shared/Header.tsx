import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { UnitToggle } from './UnitToggle'

export function Header() {
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className="cursor-pointer text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors"
          onClick={() => navigate('/dashboard')}
        >
          Sorter Conveyor Simulator
        </span>
        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
          Beta
        </span>
      </div>

      <div className="flex items-center gap-4">
        <UnitToggle />
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
