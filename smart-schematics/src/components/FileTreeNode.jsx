import React, { useState, useRef, useEffect } from 'react'
import {
  ChevronRight, ChevronDown, Folder, FolderOpen, FileText,
  Pencil, Trash2, FolderPlus, FilePlus,
} from 'lucide-react'

// Thin recursive renderer for one tree node (folder or drawing). All tree logic
// lives in src/lib/fileTree.js — this component only handles presentation,
// inline-rename input state, and the HTML5 drag-drop wiring delegated up to
// FileTree via the passed callbacks.
export default function FileTreeNode({
  node,
  depth,
  activeDrawingId,
  expanded,          // Set<string> of expanded folder ids
  onToggle,          // (folderId) => void
  onSelectDrawing,   // (drawingId) => void
  onRename,          // (id, type, newName) => void
  onDelete,          // (id, type, name) => void
  onNewFolder,       // (parentFolderId) => void
  onNewDrawing,      // (folderId) => void
  onDrop,            // (dragId, dropId|null) => void
  dragId,
  setDragId,
}) {
  const isFolder = node.type === 'folder'
  const isOpen = isFolder && expanded.has(node.id)
  const isActive = !isFolder && node.id === activeDrawingId

  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(node.name)
  const [dropHover, setDropHover] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.select(), 0)
  }, [editing])

  const startEdit = e => {
    e.stopPropagation()
    setValue(node.name)
    setEditing(true)
  }
  const commitEdit = () => {
    if (value.trim() && value.trim() !== node.name) onRename(node.id, node.type, value.trim())
    setEditing(false)
  }
  const onKeyDown = e => {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditing(false)
  }

  // ─── Drag & drop ──────────────────────────────────────────────────────────
  const handleDragStart = e => {
    e.stopPropagation()
    setDragId(node.id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', node.id)
  }
  const handleDragOver = e => {
    if (!isFolder) return // only folders accept drops
    if (dragId == null || dragId === node.id) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!dropHover) setDropHover(true)
  }
  const handleDragLeave = () => { if (dropHover) setDropHover(false) }
  const handleDrop = e => {
    if (!isFolder) return
    e.preventDefault()
    e.stopPropagation()
    setDropHover(false)
    onDrop(dragId, node.id)
    setDragId(null)
  }
  const handleDragEnd = () => setDragId(null)

  const rowClick = () => {
    if (editing) return
    if (isFolder) onToggle(node.id)
    else onSelectDrawing(node.id)
  }

  return (
    <div>
      <div
        className="group flex items-center gap-1 pr-1 py-0.5 cursor-pointer rounded text-xs"
        style={{
          paddingLeft: 4 + depth * 12,
          background: isActive
            ? 'var(--toolbar-bg)'
            : dropHover
              ? 'rgba(59,130,246,0.15)'
              : 'transparent',
          color: isActive ? 'var(--component-color)' : '#6b7280',
          outline: dropHover ? '1px dashed #3b82f6' : 'none',
        }}
        draggable={!editing}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        onClick={rowClick}
        title={node.name}
      >
        {/* Expand chevron (folders only) */}
        {isFolder ? (
          <span className="flex-shrink-0 text-gray-400" style={{ width: 12 }}>
            {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        ) : (
          <span className="flex-shrink-0" style={{ width: 12 }} />
        )}

        {/* Icon */}
        <span className="flex-shrink-0 text-blue-500">
          {isFolder
            ? (isOpen ? <FolderOpen size={13} /> : <Folder size={13} />)
            : <FileText size={13} className="text-gray-400" />}
        </span>

        {/* Name / inline rename */}
        {editing ? (
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={onKeyDown}
            onClick={e => e.stopPropagation()}
            className="flex-1 min-w-0 bg-transparent outline-none border-b text-xs"
            style={{ color: 'var(--component-color)', borderColor: '#3b82f6' }}
          />
        ) : (
          <span className="flex-1 min-w-0 truncate leading-none">{node.name}</span>
        )}

        {/* Hover action buttons */}
        {!editing && (
          <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0">
            {isFolder && (
              <>
                <button title="New folder" className="hover:text-blue-500"
                  onClick={e => { e.stopPropagation(); onNewFolder(node.id) }}>
                  <FolderPlus size={12} />
                </button>
                <button title="New drawing here" className="hover:text-blue-500"
                  onClick={e => { e.stopPropagation(); onNewDrawing(node.id) }}>
                  <FilePlus size={12} />
                </button>
              </>
            )}
            <button title="Rename" className="hover:text-blue-500" onClick={startEdit}>
              <Pencil size={11} />
            </button>
            <button title="Delete" className="hover:text-red-500"
              onClick={e => { e.stopPropagation(); onDelete(node.id, node.type, node.name) }}>
              <Trash2 size={11} />
            </button>
          </span>
        )}
      </div>

      {/* Children */}
      {isFolder && isOpen && node.children && node.children.length > 0 && (
        <div>
          {node.children.map(child => (
            <FileTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              activeDrawingId={activeDrawingId}
              expanded={expanded}
              onToggle={onToggle}
              onSelectDrawing={onSelectDrawing}
              onRename={onRename}
              onDelete={onDelete}
              onNewFolder={onNewFolder}
              onNewDrawing={onNewDrawing}
              onDrop={onDrop}
              dragId={dragId}
              setDragId={setDragId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
