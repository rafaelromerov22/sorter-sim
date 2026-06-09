import type { Project } from '../../types'

interface ProjectCardProps {
  project: Project
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}

export function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm(`Delete "${project.name}"? This cannot be undone.`)) {
      onDelete(project.id)
    }
  }

  const formattedDate = new Date(project.updated_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div
      onClick={() => onOpen(project.id)}
      className="group relative flex cursor-pointer flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
          {project.name}
        </h3>
        <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-xs uppercase text-gray-500">
          {project.unit_system}
        </span>
      </div>

      {project.description && (
        <p className="mt-1 line-clamp-2 text-sm text-gray-500">
          {project.description}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-gray-400">Updated {formattedDate}</span>
        <button
          onClick={handleDelete}
          className="text-xs text-red-400 opacity-0 transition-all group-hover:opacity-100 hover:text-red-600"
          title="Delete project"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
