import React, { useState, useRef, useEffect } from 'react'
import { X, Plus, Folder, FolderOpen, Trash2, Edit2, Check } from 'lucide-react'
import useSchematicStore from '../store/schematicStore'

export default function ProjectBrowser({ onClose }) {
  const projects = useSchematicStore(s => s.projects)
  const activeProjectId = useSchematicStore(s => s.activeProjectId)
  const drawings = useSchematicStore(s => s.drawings)
  const newProject = useSchematicStore(s => s.newProject)
  const setActiveProject = useSchematicStore(s => s.setActiveProject)
  const renameProject = useSchematicStore(s => s.renameProject)
  const deleteProject = useSchematicStore(s => s.deleteProject)

  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const editRef = useRef(null)
  const newRef = useRef(null)

  useEffect(() => {
    if (editingId && editRef.current) editRef.current.select()
  }, [editingId])

  useEffect(() => {
    if (creating && newRef.current) newRef.current.focus()
  }, [creating])

  const startEdit = (id, name) => {
    setEditingId(id)
    setEditValue(name)
  }

  const commitEdit = () => {
    if (editingId && editValue.trim()) renameProject(editingId, editValue.trim())
    setEditingId(null)
  }

  const handleCreate = () => {
    const name = newName.trim() || `Project ${projects.length + 1}`
    newProject(name)
    setCreating(false)
    setNewName('')
    onClose()
  }

  const handleOpen = (id) => {
    setActiveProject(id)
    onClose()
  }

  const handleDelete = (id) => {
    if (confirmDeleteId === id) {
      deleteProject(id)
      setConfirmDeleteId(null)
      if (id === activeProjectId && projects.length > 1) {
        // store already switched to another project
        onClose()
      }
    } else {
      setConfirmDeleteId(id)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-lg shadow-2xl border flex flex-col"
        style={{
          background: 'var(--panel-bg)',
          borderColor: 'var(--panel-border)',
          width: 480,
          maxHeight: '70vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: 'var(--panel-border)' }}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--component-color)' }}>
            Projects
          </span>
          <div className="flex-1" />
          <button
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10"
            onClick={onClose}
          >
            <X size={14} style={{ color: 'var(--component-color)' }} />
          </button>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {projects.map(project => {
            const projectDrawings = project.drawingIds
              .map(id => drawings.find(d => d.id === id))
              .filter(Boolean)
            const isActive = project.id === activeProjectId
            const isEditing = editingId === project.id
            const isConfirming = confirmDeleteId === project.id

            return (
              <div
                key={project.id}
                className="flex items-center gap-2 px-3 py-2 rounded group cursor-pointer"
                style={{
                  background: isActive ? 'var(--toolbar-bg)' : 'transparent',
                  border: `1px solid ${isActive ? 'var(--panel-border)' : 'transparent'}`,
                }}
                onClick={() => !isEditing && handleOpen(project.id)}
              >
                {isActive
                  ? <FolderOpen size={16} className="text-blue-500 flex-shrink-0" />
                  : <Folder size={16} className="text-gray-400 flex-shrink-0" />
                }

                {isEditing ? (
                  <input
                    ref={editRef}
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitEdit()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="flex-1 bg-transparent outline-none text-sm border-b"
                    style={{
                      color: 'var(--component-color)',
                      borderColor: 'var(--panel-border)',
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm truncate"
                      style={{ color: 'var(--component-color)' }}
                    >
                      {project.name}
                      {isActive && (
                        <span className="ml-2 text-xs text-blue-500">(active)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {projectDrawings.length} drawing{projectDrawings.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                )}

                <div
                  className="flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10"
                    onClick={() => startEdit(project.id, project.name)}
                    title="Rename"
                  >
                    <Edit2 size={11} style={{ color: 'var(--component-color)' }} />
                  </button>
                  {projects.length > 1 && (
                    <button
                      className={`w-6 h-6 flex items-center justify-center rounded ${isConfirming ? 'bg-red-500' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}
                      onClick={() => handleDelete(project.id)}
                      title={isConfirming ? 'Click again to confirm delete' : 'Delete project'}
                    >
                      <Trash2 size={11} style={{ color: isConfirming ? 'white' : 'var(--component-color)' }} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Create new project */}
        <div
          className="border-t p-3 flex-shrink-0"
          style={{ borderColor: 'var(--panel-border)' }}
        >
          {creating ? (
            <div className="flex items-center gap-2">
              <input
                ref={newRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreate()
                  if (e.key === 'Escape') { setCreating(false); setNewName('') }
                }}
                placeholder={`Project ${projects.length + 1}`}
                className="flex-1 px-2 py-1 rounded border text-sm bg-transparent outline-none"
                style={{
                  color: 'var(--component-color)',
                  borderColor: 'var(--panel-border)',
                }}
              />
              <button
                className="px-3 py-1 rounded text-xs font-medium bg-blue-500 text-white hover:bg-blue-600"
                onClick={handleCreate}
              >
                Create
              </button>
              <button
                className="px-2 py-1 rounded text-xs hover:bg-black/10 dark:hover:bg-white/10"
                style={{ color: 'var(--component-color)' }}
                onClick={() => { setCreating(false); setNewName('') }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 w-full"
              style={{ color: 'var(--component-color)' }}
              onClick={() => setCreating(true)}
            >
              <Plus size={12} />
              New Project
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
