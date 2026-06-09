import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../../store/projectStore'
import { Header } from '../shared/Header'
import { ProjectCard } from './ProjectCard'
import { CreateProjectModal } from './CreateProjectModal'

export function ProjectDashboard() {
  const navigate = useNavigate()
  const { projects, loading, error, fetchProjects, createProject, deleteProject } =
    useProjectStore()
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const handleCreate = async (name: string, description: string) => {
    setCreating(true)
    setCreateError(null)
    const project = await createProject(name, description)
    setCreating(false)
    if (project) {
      setShowModal(false)
      navigate(`/project/${project.id}`)
    } else {
      // Keep modal open, show the error from the store
      setCreateError(useProjectStore.getState().error ?? 'Failed to create project')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
            <p className="mt-1 text-sm text-gray-500">
              {projects.length === 0
                ? 'No projects yet'
                : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + New Project
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Error loading projects: {error}
          </div>
        )}

        {loading && projects.length === 0 ? (
          <div className="mt-12 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : projects.length === 0 && !loading ? (
          <div className="mt-16 text-center">
            <p className="text-lg text-gray-400">No projects yet.</p>
            <p className="mt-1 text-sm text-gray-400">
              Create your first project to get started.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create first project
            </button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={(id) => navigate(`/project/${id}`)}
                onDelete={deleteProject}
              />
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <CreateProjectModal
          onConfirm={handleCreate}
          onCancel={() => { setShowModal(false); setCreateError(null) }}
          isLoading={creating}
          error={createError}
        />
      )}
    </div>
  )
}
