// src/components/project/LinesTabs.tsx
import { useState } from 'react'
import { useConfigStore } from '../../store/configStore'

export function LinesTabs() {
  const { lines, activeLineId, setActiveLineId, addLine, removeLine, renameLine, duplicateLine } =
    useConfigStore(s => ({
      lines:           s.lines,
      activeLineId:    s.activeLineId,
      setActiveLineId: s.setActiveLineId,
      addLine:         s.addLine,
      removeLine:      s.removeLine,
      renameLine:      s.renameLine,
      duplicateLine:   s.duplicateLine,
    }))

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  function startEdit(id: string, name: string) {
    setEditingId(id)
    setEditValue(name)
  }

  function commitEdit() {
    if (editingId && editValue.trim()) {
      renameLine(editingId, editValue.trim())
    }
    setEditingId(null)
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200 bg-white px-3 py-1">
      {lines.map(line => (
        <div
          key={line.id}
          className={`group flex shrink-0 items-center gap-1 rounded-t px-3 py-1.5 text-sm cursor-pointer select-none ${
            activeLineId === line.id
              ? 'border-b-2 border-blue-600 font-medium text-blue-700'
              : 'text-gray-500 hover:text-gray-800'
          }`}
          onClick={() => setActiveLineId(line.id)}
        >
          {editingId === line.id ? (
            <input
              autoFocus
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit() }}
              className="w-24 rounded border border-blue-300 px-1 text-sm focus:outline-none"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span onDoubleClick={e => { e.stopPropagation(); startEdit(line.id, line.name) }}>
              {line.name}
            </span>
          )}

          {/* Context menu buttons — visible on hover */}
          <span
            className="hidden group-hover:flex items-center gap-0.5 ml-1"
            onClick={e => e.stopPropagation()}
          >
            <button
              title="Rename"
              onClick={() => startEdit(line.id, line.name)}
              className="rounded p-0.5 text-gray-400 hover:text-gray-600"
            >
              ✎
            </button>
            <button
              title="Duplicate"
              onClick={() => duplicateLine(line.id)}
              className="rounded p-0.5 text-gray-400 hover:text-gray-600"
            >
              ⎘
            </button>
            {lines.length > 1 && (
              <button
                title="Delete"
                onClick={() => removeLine(line.id)}
                className="rounded p-0.5 text-red-300 hover:text-red-500"
              >
                ✕
              </button>
            )}
          </span>
        </div>
      ))}

      <button
        onClick={addLine}
        className="shrink-0 rounded px-2 py-1 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        title="Add line"
      >
        +
      </button>
    </div>
  )
}
