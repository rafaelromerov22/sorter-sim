// src/components/project/VersionHistory.tsx
import { useState } from 'react'
import { useConfigStore } from '../../store/configStore'
import type { ProjectVersion } from '../../types'

export function VersionHistory() {
  const [collapsed, setCollapsed] = useState(false)
  const [labelInput, setLabelInput] = useState('')

  const { versions, versionsLoading, saveLoading, saveVersion, restoreVersion } =
    useConfigStore(s => ({
      versions:       s.versions,
      versionsLoading: s.versionsLoading,
      saveLoading:    s.saveLoading,
      saveVersion:    s.saveVersion,
      restoreVersion: s.restoreVersion,
    }))

  async function handleSave() {
    await saveVersion(labelInput.trim() || undefined)
    setLabelInput('')
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className={`flex flex-col border-l border-gray-200 bg-white transition-all ${collapsed ? 'w-8' : 'w-64'}`}>
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex h-10 items-center justify-center border-b border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
        title={collapsed ? 'Expand version history' : 'Collapse'}
      >
        {collapsed ? '◁' : '▷'}
      </button>

      {!collapsed && (
        <>
          <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
            <span className="text-xs font-semibold text-gray-700">Version History</span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
              {versions.length}
            </span>
          </div>

          {/* Save with label */}
          <div className="flex gap-1 border-b border-gray-200 p-2">
            <input
              type="text"
              placeholder="Label (optional)"
              value={labelInput}
              onChange={e => setLabelInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
            <button
              onClick={handleSave}
              disabled={saveLoading}
              className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saveLoading ? '…' : 'Save'}
            </button>
          </div>

          {/* Version list */}
          <div className="flex-1 overflow-y-auto">
            {versionsLoading && (
              <p className="py-4 text-center text-xs text-gray-400">Loading…</p>
            )}
            {!versionsLoading && versions.length === 0 && (
              <p className="py-4 text-center text-xs text-gray-400">No saved versions yet.</p>
            )}
            {versions.map(v => (
              <VersionRow key={v.id} version={v} onRestore={restoreVersion} formatDate={formatDate} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function VersionRow({
  version,
  onRestore,
  formatDate,
}: {
  version: ProjectVersion
  onRestore: (v: ProjectVersion) => void
  formatDate: (iso: string) => string
}) {
  return (
    <div className="group flex items-start justify-between gap-1 border-b border-gray-100 px-3 py-2 hover:bg-gray-50">
      <div className="flex flex-col">
        <span className="text-xs font-medium text-gray-700">
          v{version.version_num}
          {version.label && (
            <span className="ml-1 font-normal text-gray-500">— {version.label}</span>
          )}
        </span>
        <span className="text-xs text-gray-400">{formatDate(version.created_at)}</span>
      </div>
      <button
        onClick={() => onRestore(version)}
        className="shrink-0 rounded px-1.5 py-0.5 text-xs text-blue-600 opacity-0 group-hover:opacity-100 hover:bg-blue-50"
      >
        Restore
      </button>
    </div>
  )
}
