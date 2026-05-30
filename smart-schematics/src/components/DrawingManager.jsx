import React, { useState, useRef } from 'react'
import { Plus, X, FolderOpen } from 'lucide-react'
import useSchematicStore from '../store/schematicStore'
import FileMenu from './FileMenu'

export default function DrawingManager() {
  const drawings = useSchematicStore(s => s.drawings)
  const activeDrawingId = useSchematicStore(s => s.activeDrawingId)
  const projects = useSchematicStore(s => s.projects)
  const activeProjectId = useSchematicStore(s => s.activeProjectId)
  const newDrawing = useSchematicStore(s => s.newDrawing)
  const setActiveDrawing = useSchematicStore(s => s.setActiveDrawing)
  const renameDrawing = useSchematicStore(s => s.renameDrawing)
  const closeDrawing = useSchematicStore(s => s.closeDrawing)
  const setShowProjectBrowser = useSchematicStore(s => s.setShowProjectBrowser)

  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef(null)

  const activeProject = projects.find(p => p.id === activeProjectId)
  // Only show drawings belonging to the active project
  const projectDrawings = activeProject
    ? activeProject.drawingIds.map(id => drawings.find(d => d.id === id)).filter(Boolean)
    : []

  const startEdit = (id, name) => {
    setEditingId(id)
    setEditValue(name)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commitEdit = () => {
    if (editingId && editValue.trim()) {
      renameDrawing(editingId, editValue.trim())
    }
    setEditingId(null)
  }

  const onTabKeyDown = e => {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditingId(null)
  }

  const handleClose = (e, drawing) => {
    e.stopPropagation()
    if (drawing.isDirty) {
      const ok = window.confirm(`"${drawing.name}" has unsaved changes. Close anyway?`)
      if (!ok) return
    }
    closeDrawing(drawing.id)
  }

  return (
    <div
      className="flex items-center border-b flex-shrink-0"
      style={{
        background: 'var(--toolbar-bg)',
        borderColor: 'var(--panel-border)',
        height: 36,
        minHeight: 36,
      }}
    >
      {/* File menu */}
      <FileMenu />

      {/* Project name badge */}
      {activeProject && (
        <button
          className="flex items-center gap-1 px-2 h-full text-xs border-r hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex-shrink-0"
          style={{
            borderColor: 'var(--panel-border)',
            color: '#6b7280',
            maxWidth: 140,
          }}
          onClick={() => setShowProjectBrowser(true)}
          title="Manage projects"
        >
          <FolderOpen size={11} className="flex-shrink-0 text-blue-500" />
          <span className="truncate">{activeProject.name}</span>
        </button>
      )}

      {/* Drawing tabs — scrollable */}
      <div className="flex items-center overflow-x-auto flex-1 select-none" style={{ minWidth: 0 }}>
        {projectDrawings.map(d => (
          <div
            key={d.id}
            className="flex items-center px-3 h-full border-r cursor-pointer group relative flex-shrink-0"
            style={{
              borderColor: 'var(--panel-border)',
              background: d.id === activeDrawingId ? 'var(--panel-bg)' : 'transparent',
              color: d.id === activeDrawingId ? 'var(--component-color)' : '#6b7280',
              minWidth: 80,
              maxWidth: 160,
              height: 36,
            }}
            onClick={() => setActiveDrawing(d.id)}
            onDoubleClick={() => startEdit(d.id, d.name)}
          >
            {editingId === d.id ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={onTabKeyDown}
                className="w-full bg-transparent outline-none text-xs"
                style={{ color: 'var(--component-color)' }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="text-xs truncate flex-1 leading-none">
                {d.isDirty && (
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1 mb-0.5"
                    title="Unsaved changes"
                  />
                )}
                {d.name}
              </span>
            )}
            {projectDrawings.length > 1 && (
              <button
                className="ml-1 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
                onClick={e => handleClose(e, d)}
                tabIndex={-1}
                title="Close drawing"
              >
                <X size={11} />
              </button>
            )}
          </div>
        ))}

        <button
          className="flex items-center justify-center h-full px-3 hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex-shrink-0"
          style={{ height: 36 }}
          onClick={newDrawing}
          title="New Drawing (Ctrl+N)"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}
