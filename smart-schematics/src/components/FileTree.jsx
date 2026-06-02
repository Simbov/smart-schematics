import React, { useState, useRef } from 'react'
import { FolderPlus, FilePlus, Paperclip, Plus, X, Download } from 'lucide-react'
import useSchematicStore from '../store/schematicStore'
import { buildTree, findNode, canMove } from '../lib/fileTree'
import FileTreeNode from './FileTreeNode'

// Reads a File into a base64 data URL (works in both the browser and the Tauri
// webview). Used to embed attachments inline in the .scpro bundle.
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// Container for the file-tree sidebar body. Builds the nested node array from the
// active project's folders + drawings (pure logic in lib/fileTree.js), then
// delegates rendering to FileTreeNode. Validates drag-drop via canMove() before
// touching the store. Also hosts the project-level Attachments section.
export default function FileTree() {
  const projects = useSchematicStore(s => s.projects)
  const activeProjectId = useSchematicStore(s => s.activeProjectId)
  const drawings = useSchematicStore(s => s.drawings)
  const activeDrawingId = useSchematicStore(s => s.activeDrawingId)

  const setActiveDrawing = useSchematicStore(s => s.setActiveDrawing)
  const renameDrawing = useSchematicStore(s => s.renameDrawing)
  const closeDrawing = useSchematicStore(s => s.closeDrawing)
  const newDrawing = useSchematicStore(s => s.newDrawing)
  const addFolder = useSchematicStore(s => s.addFolder)
  const renameFolder = useSchematicStore(s => s.renameFolder)
  const deleteFolder = useSchematicStore(s => s.deleteFolder)
  const moveFolder = useSchematicStore(s => s.moveFolder)
  const moveDrawingToFolder = useSchematicStore(s => s.moveDrawingToFolder)
  const addAttachment = useSchematicStore(s => s.addAttachment)
  const removeAttachment = useSchematicStore(s => s.removeAttachment)

  const [expanded, setExpanded] = useState(() => new Set())
  const [dragId, setDragId] = useState(null)
  const [rootDropHover, setRootDropHover] = useState(false)
  const fileInputRef = useRef(null)

  const project = projects.find(p => p.id === activeProjectId)
  if (!project) {
    return <div className="px-3 py-2 text-xs text-gray-400">No project open.</div>
  }

  const projectDrawings = project.drawingIds
    .map(id => drawings.find(d => d.id === id))
    .filter(Boolean)
  const tree = buildTree(project, projectDrawings)
  const attachments = project.attachments || []

  const toggle = id =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const handleRename = (id, type, name) => {
    if (type === 'folder') renameFolder(id, name)
    else renameDrawing(id, name)
  }

  const handleDelete = (id, type, name) => {
    if (type === 'folder') {
      if (window.confirm(`Delete folder "${name}"? Its drawings move to the root.`)) {
        deleteFolder(id)
      }
    } else {
      if (projectDrawings.length <= 1) {
        window.alert('A project must keep at least one drawing.')
        return
      }
      if (window.confirm(`Delete drawing "${name}"?`)) closeDrawing(id)
    }
  }

  const handleNewFolder = (parentId = null) => {
    const id = addFolder('New Folder', parentId)
    if (parentId != null) setExpanded(prev => new Set(prev).add(parentId))
    return id
  }

  const handleNewDrawing = (folderId = null) => {
    newDrawing(folderId)
    if (folderId != null) setExpanded(prev => new Set(prev).add(folderId))
  }

  // Validate the move with the pure canMove() before mutating the store, then
  // dispatch the right action depending on whether a folder or drawing moved.
  const handleDrop = (dId, dropId) => {
    if (dId == null) return
    if (!canMove(tree, dId, dropId)) return
    const node = findNode(tree, dId)
    if (!node) return
    if (node.type === 'folder') moveFolder(dId, dropId)
    else moveDrawingToFolder(dId, dropId)
    if (dropId != null) setExpanded(prev => new Set(prev).add(dropId))
  }

  // Root drop zone (empty area / header) re-parents to root.
  const onRootDragOver = e => {
    if (dragId == null) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!rootDropHover) setRootDropHover(true)
  }
  const onRootDrop = e => {
    e.preventDefault()
    handleDrop(dragId, null)
    setDragId(null)
    setRootDropHover(false)
  }

  const onPickAttachment = async e => {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      try {
        const data = await readFileAsDataUrl(file)
        addAttachment({ name: file.name, mime: file.type || 'application/octet-stream', data })
      } catch {
        window.alert(`Could not read "${file.name}".`)
      }
    }
    e.target.value = '' // allow re-selecting the same file
  }

  // Export an attachment's base64 back out to disk (browser download path).
  const exportAttachment = att => {
    try {
      const a = document.createElement('a')
      a.href = att.data
      a.download = att.name || 'attachment'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch {
      window.alert('Could not export attachment.')
    }
  }

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Toolbar: new root folder / new root drawing */}
      <div
        className="flex items-center gap-1 px-2 py-1 border-b flex-shrink-0"
        style={{ borderColor: 'var(--panel-border)' }}
      >
        <span className="flex-1 truncate text-gray-500 font-medium" title={project.name}>
          {project.name}
        </span>
        <button className="text-gray-400 hover:text-blue-500" title="New folder"
          onClick={() => handleNewFolder(null)}>
          <FolderPlus size={14} />
        </button>
        <button className="text-gray-400 hover:text-blue-500" title="New drawing"
          onClick={() => handleNewDrawing(null)}>
          <FilePlus size={14} />
        </button>
      </div>

      {/* Tree body — also the root drop target */}
      <div
        className="flex-1 overflow-y-auto py-1 px-1"
        style={{ outline: rootDropHover ? '1px dashed #3b82f6' : 'none' }}
        onDragOver={onRootDragOver}
        onDragLeave={() => setRootDropHover(false)}
        onDrop={onRootDrop}
      >
        {tree.length === 0 ? (
          <p className="px-2 py-2 text-gray-400">No drawings yet.</p>
        ) : (
          tree.map(node => (
            <FileTreeNode
              key={node.id}
              node={node}
              depth={0}
              activeDrawingId={activeDrawingId}
              expanded={expanded}
              onToggle={toggle}
              onSelectDrawing={setActiveDrawing}
              onRename={handleRename}
              onDelete={handleDelete}
              onNewFolder={handleNewFolder}
              onNewDrawing={handleNewDrawing}
              onDrop={handleDrop}
              dragId={dragId}
              setDragId={setDragId}
            />
          ))
        )}
      </div>

      {/* Attachments section */}
      <div className="border-t flex-shrink-0" style={{ borderColor: 'var(--panel-border)' }}>
        <div className="flex items-center gap-1 px-2 py-1 text-gray-500">
          <Paperclip size={12} className="flex-shrink-0" />
          <span className="flex-1 font-medium">Attachments</span>
          <button className="text-gray-400 hover:text-blue-500" title="Add file"
            onClick={() => fileInputRef.current?.click()}>
            <Plus size={14} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={onPickAttachment}
          />
        </div>
        <div className="max-h-32 overflow-y-auto px-1 pb-1">
          {attachments.length === 0 ? (
            <p className="px-2 py-1 text-gray-400">No attachments.</p>
          ) : (
            attachments.map(att => (
              <div key={att.id}
                className="group flex items-center gap-1 px-2 py-0.5 rounded text-gray-500">
                <Paperclip size={11} className="flex-shrink-0 text-gray-400" />
                <span className="flex-1 min-w-0 truncate" title={att.name}>{att.name}</span>
                <button className="opacity-0 group-hover:opacity-100 hover:text-blue-500"
                  title="Export" onClick={() => exportAttachment(att)}>
                  <Download size={11} />
                </button>
                <button className="opacity-0 group-hover:opacity-100 hover:text-red-500"
                  title="Remove"
                  onClick={() => {
                    if (window.confirm(`Remove attachment "${att.name}"?`)) removeAttachment(att.id)
                  }}>
                  <X size={11} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
