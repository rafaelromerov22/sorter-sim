import { useParams } from 'react-router-dom'
import { Header } from '../shared/Header'

export function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <h2 className="text-xl font-semibold text-gray-700">Project Workspace</h2>
          <p className="mt-2 text-sm text-gray-400">Project ID: {id}</p>
          <p className="mt-1 text-sm text-gray-400">
            Simulation canvas and config panel — coming in Stage 2.
          </p>
        </div>
      </main>
    </div>
  )
}
