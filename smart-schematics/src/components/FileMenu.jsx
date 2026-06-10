import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  ChevronDown, ChevronRight, FilePlus, Copy, Download, Upload,
  FolderOpen, Save, SaveAll, Clock, X, RefreshCw, Paperclip, Trash2, Cpu,
} from 'lucide-react'
import useSchematicStore from '../store/schematicStore'
import { isRunningInTauri, basename } from '../lib/tauriFs'
import { checkForUpdates } from '../lib/updater'
import { projectSize, formatBytes, isOverSizeLimit } from '../lib/projectFile'

function downloadBlob(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function getSVGElement() {
  return document.querySelector('svg[data-schematic]')
}

export default function FileMenu() {
  const [open, setOpen] = useState(false)
  const [recentOpen, setRecentOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const menuRef = useRef(null)
  const importRef = useRef(null)
  const importProjectRef = useRef(null)
  const attachRef = useRef(null)

  const activeDrawingId = useSchematicStore(s => s.activeDrawingId)
  const drawings = useSchematicStore(s => s.drawings)
  const activeProjectId = useSchematicStore(s => s.activeProjectId)
  const projects = useSchematicStore(s => s.projects)
  const currentFilePath = useSchematicStore(s => s.currentFilePath)
  const recentFiles = useSchematicStore(s => s.recentFiles)
  const drawing = drawings.find(d => d.id === activeDrawingId)

  const newDrawing = useSchematicStore(s => s.newDrawing)
  const duplicateDrawing = useSchematicStore(s => s.duplicateDrawing)
  const exportDrawingJSON = useSchematicStore(s => s.exportDrawingJSON)
  const importDrawingJSON = useSchematicStore(s => s.importDrawingJSON)
  const exportProjectJSON = useSchematicStore(s => s.exportProjectJSON)
  const importProjectJSON = useSchematicStore(s => s.importProjectJSON)
  const setShowProjectBrowser = useSchematicStore(s => s.setShowProjectBrowser)
  const setShowPlcDeviceManager = useSchematicStore(s => s.setShowPlcDeviceManager)
  const openProjectFile = useSchematicStore(s => s.openProjectFile)
  const saveProjectFile = useSchematicStore(s => s.saveProjectFile)
  const saveProjectFileAs = useSchematicStore(s => s.saveProjectFileAs)
  const _loadProjectFromPath = useSchematicStore(s => s._loadProjectFromPath)
  const removeRecentFileFn = useSchematicStore(s => s.removeRecentFile)
  const attachFile = useSchematicStore(s => s.attachFile)
  const addAttachment = useSchematicStore(s => s.addAttachment)
  const removeAttachment = useSchematicStore(s => s.removeAttachment)
  const exportAttachment = useSchematicStore(s => s.exportAttachment)

  const inTauri = isRunningInTauri()

  const project = projects.find(p => p.id === activeProjectId)
  const attachments = project?.attachments || []

  // Estimated serialized file size for the size-awareness line in the menu.
  const sizeBytes = (() => {
    if (!project) return 0
    const projectDrawings = (project.drawingIds || [])
      .map(id => drawings.find(d => d.id === id))
      .filter(Boolean)
    return projectSize({ version: 3, ...project, drawings: projectDrawings })
  })()
  const sizeOver = isOverSizeLimit(sizeBytes)

  useEffect(() => {
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
        setRecentOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const action = useCallback((fn) => () => { setOpen(false); setRecentOpen(false); fn() }, [])

  // Compute tight content bounds from drawing data (world coords)
  const getContentBounds = useCallback((pad = 30) => {
    if (!drawing) return null
    const xs = [], ys = []
    for (const c of (drawing.components || [])) {
      xs.push(c.x - 40, c.x + 40)
      ys.push(c.y - 40, c.y + 40)
    }
    for (const w of (drawing.wires || [])) {
      for (const p of w.points) { xs.push(p.x); ys.push(p.y) }
    }
    for (const a of (drawing.annotations || [])) {
      xs.push(a.x); ys.push(a.y)
      if (a.type === 'callout') {
        xs.push(a.x + (a.width || 120))
        ys.push(a.y + (a.height || 60))
      }
    }
    if (!xs.length) return null
    return {
      minX: Math.min(...xs) - pad,
      minY: Math.min(...ys) - pad,
      maxX: Math.max(...xs) + pad,
      maxY: Math.max(...ys) + pad,
    }
  }, [drawing])

  const exportSVG = useCallback(() => {
    const svgEl = getSVGElement()
    if (!svgEl) return
    // Rich-text annotations render via <foreignObject> + XHTML <div>. We clone
    // the live SVG as-is, so the foreignObject (and per-run styling) is carried
    // into the exported .svg — modern viewers render it. AnnotationLayer also
    // draws an opacity-0 plain <text> fallback behind each foreignObject as a
    // safety net for rasterizers that drop foreignObject; it ships in the clone
    // too. We deliberately do not strip either layer here.
    const clone = svgEl.cloneNode(true)
    const gridG = Array.from(clone.children).find(el => el.tagName === 'g' && !el.hasAttribute('transform'))
    if (gridG) clone.removeChild(gridG)
    const contentG = clone.querySelector('g[transform]')
    if (contentG) contentG.removeAttribute('transform')
    const bounds = getContentBounds(30)
    let vbWidth, vbHeight
    if (bounds) {
      vbWidth = bounds.maxX - bounds.minX
      vbHeight = bounds.maxY - bounds.minY
      clone.setAttribute('viewBox', `${bounds.minX} ${bounds.minY} ${vbWidth} ${vbHeight}`)
      clone.setAttribute('width', vbWidth)
      clone.setAttribute('height', vbHeight)
    } else {
      clone.setAttribute('viewBox', '0 0 800 600')
      clone.setAttribute('width', 800)
      clone.setAttribute('height', 600)
    }
    clone.removeAttribute('style')
    const str = new XMLSerializer().serializeToString(clone)
    const blob = new Blob([str], { type: 'image/svg+xml' })
    downloadBlob(blob, `${drawing?.name || 'schematic'}.svg`)
  }, [drawing, getContentBounds])

  const exportPNG = useCallback(() => {
    const svgEl = getSVGElement()
    if (!svgEl) return
    const clone = svgEl.cloneNode(true)
    const gridG = Array.from(clone.children).find(el => el.tagName === 'g' && !el.hasAttribute('transform'))
    if (gridG) clone.removeChild(gridG)
    const contentG = clone.querySelector('g[transform]')
    if (contentG) contentG.removeAttribute('transform')
    const bounds = getContentBounds(30)
    let vbWidth, vbHeight
    if (bounds) {
      vbWidth = bounds.maxX - bounds.minX
      vbHeight = bounds.maxY - bounds.minY
      clone.setAttribute('viewBox', `${bounds.minX} ${bounds.minY} ${vbWidth} ${vbHeight}`)
      clone.setAttribute('width', vbWidth)
      clone.setAttribute('height', vbHeight)
    } else {
      vbWidth = 800; vbHeight = 600
      clone.setAttribute('viewBox', '0 0 800 600')
      clone.setAttribute('width', vbWidth)
      clone.setAttribute('height', vbHeight)
    }
    clone.removeAttribute('style')
    const scale = 3
    const str = new XMLSerializer().serializeToString(clone)
    const blob = new Blob([str], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = vbWidth * scale
      canvas.height = vbHeight * scale
      const ctx = canvas.getContext('2d')
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob(pngBlob => {
        downloadBlob(pngBlob, `${drawing?.name || 'schematic'}.png`)
      }, 'image/png')
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }, [drawing, getContentBounds])

  const handleImportDrawing = useCallback(e => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => importDrawingJSON(ev.target.result)
    reader.readAsText(file)
    e.target.value = ''
  }, [importDrawingJSON])

  const handleImportProject = useCallback(e => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => importProjectJSON(ev.target.result)
    reader.readAsText(file)
    e.target.value = ''
  }, [importProjectJSON])

  // Browser fallback for "Attach File…": read the picked file as base64 and embed.
  const handleAttachFile = useCallback(e => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const result = ev.target.result || ''
      // FileReader.readAsDataURL → "data:<mime>;base64,<payload>"; strip the prefix.
      const comma = String(result).indexOf(',')
      const data = comma >= 0 ? String(result).slice(comma + 1) : String(result)
      addAttachment({ name: file.name, mime: file.type || 'application/octet-stream', data })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [addAttachment])

  const handleAttachClick = useCallback(() => {
    if (inTauri) attachFile()
    else attachRef.current?.click()
  }, [inTauri, attachFile])

  const menuItemStyle = {
    color: 'var(--component-color)',
  }

  const separatorStyle = {
    height: 1,
    background: 'var(--panel-border)',
    margin: '4px 0',
  }

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        className="flex items-center gap-1 px-2 h-8 rounded text-xs hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex-shrink-0"
        style={{ color: 'var(--component-color)' }}
        onClick={() => { setOpen(v => !v); setRecentOpen(false) }}
      >
        <span>File</span>
        <ChevronDown size={10} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 rounded shadow-lg border py-1"
          style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)', minWidth: 240 }}
        >
          {/* New Drawing */}
          <MenuItem icon={<FilePlus size={12} />} label="New Drawing" shortcut="Ctrl+N"
            onClick={action(newDrawing)} style={menuItemStyle} />
          <MenuItem icon={<Copy size={12} />} label="Duplicate Drawing"
            onClick={action(() => activeDrawingId && duplicateDrawing(activeDrawingId))}
            disabled={!activeDrawingId} style={menuItemStyle} />

          <div style={separatorStyle} />

          {/* File-level open/save — shown in both Tauri and browser */}
          <MenuItem icon={<FolderOpen size={12} />} label="Open Project…" shortcut="Ctrl+O"
            onClick={action(() => inTauri ? openProjectFile() : importProjectRef.current?.click())}
            style={menuItemStyle} />

          {/* Open Recent — only meaningful in Tauri where paths are known */}
          {inTauri && recentFiles.length > 0 && (
            <div
              className="relative flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
              style={menuItemStyle}
              onMouseEnter={() => setRecentOpen(true)}
              onMouseLeave={() => setRecentOpen(false)}
            >
              <span className="text-gray-400"><Clock size={12} /></span>
              <span className="flex-1">Open Recent</span>
              <ChevronRight size={10} className="text-gray-400" />
              {recentOpen && (
                <div
                  className="absolute left-full top-0 z-50 rounded shadow-lg border py-1"
                  style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)', minWidth: 260 }}
                >
                  {recentFiles.map(path => (
                    <div
                      key={path}
                      className="group flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                      style={menuItemStyle}
                    >
                      <span
                        className="flex-1 truncate"
                        title={path}
                        onClick={() => { setOpen(false); setRecentOpen(false); _loadProjectFromPath(path) }}
                      >
                        {basename(path)}
                      </span>
                      <button
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-opacity"
                        title="Remove from recent"
                        onClick={e => { e.stopPropagation(); removeRecentFileFn(path) }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <MenuItem icon={<Save size={12} />} label="Save" shortcut="Ctrl+S"
            onClick={action(() => saveProjectFile())} disabled={!activeProjectId}
            style={menuItemStyle} />
          <MenuItem icon={<SaveAll size={12} />} label="Save As…"
            onClick={action(() => saveProjectFileAs())} disabled={!activeProjectId}
            style={menuItemStyle} />

          <div style={separatorStyle} />

          {/* Drawing-level exports (unchanged) */}
          <MenuItem icon={<Download size={12} />} label="Export Drawing as JSON"
            onClick={action(() => activeDrawingId && exportDrawingJSON(activeDrawingId))}
            disabled={!activeDrawingId} style={menuItemStyle} />
          <MenuItem icon={<Download size={12} />} label="Export Drawing as SVG"
            onClick={action(exportSVG)} disabled={!activeDrawingId} style={menuItemStyle} />
          <MenuItem icon={<Download size={12} />} label="Export Drawing as PNG"
            onClick={action(exportPNG)} disabled={!activeDrawingId} style={menuItemStyle} />
          <MenuItem icon={<Upload size={12} />} label="Import Drawing from JSON"
            onClick={action(() => importRef.current?.click())} style={menuItemStyle} />

          <div style={separatorStyle} />

          {/* Project-level export (browser export remains available) */}
          <MenuItem icon={<Download size={12} />} label="Export Project as JSON"
            onClick={action(() => activeProjectId && exportProjectJSON(activeProjectId))}
            disabled={!activeProjectId} style={menuItemStyle} />
          {!inTauri && (
            <MenuItem icon={<Upload size={12} />} label="Import Project from JSON"
              onClick={action(() => importProjectRef.current?.click())} style={menuItemStyle} />
          )}

          <div style={separatorStyle} />

          {/* Attachments — embedded sub-files on the project (Stage 7) */}
          <MenuItem icon={<Paperclip size={12} />} label="Attach File…"
            onClick={action(handleAttachClick)} disabled={!activeProjectId} style={menuItemStyle} />
          <MenuItem icon={<Paperclip size={12} />}
            label={`Manage Attachments…${attachments.length ? ` (${attachments.length})` : ''}`}
            onClick={action(() => setManageOpen(true))} disabled={!activeProjectId} style={menuItemStyle} />

          <div style={separatorStyle} />

          {/* PLC hardware registry — define devices + pins once, I/O components
              auto-populate from it (PLC release). */}
          <MenuItem icon={<Cpu size={12} />} label="PLC Devices…"
            onClick={action(() => setShowPlcDeviceManager(true))} disabled={!activeProjectId}
            style={menuItemStyle} />

          <div style={separatorStyle} />

          <MenuItem icon={<FolderOpen size={12} />} label="Manage Projects…"
            onClick={action(() => setShowProjectBrowser(true))} style={menuItemStyle} />

          {/* Size awareness — warn past the threshold. */}
          <div
            className="px-3 py-1.5 text-xs"
            style={{ color: sizeOver ? '#eab308' : '#9ca3af' }}
            title={sizeOver
              ? 'Large project file — remove unused images/attachments to keep sync fast.'
              : 'Estimated saved file size'}
          >
            {sizeOver ? '⚠ ' : ''}Project size: {formatBytes(sizeBytes)}
          </div>

          <div style={separatorStyle} />

          <MenuItem icon={<RefreshCw size={12} />} label="Check for Updates…"
            onClick={action(() => checkForUpdates({ silent: false }))} style={menuItemStyle} />
        </div>
      )}

      {/* Hidden file inputs (browser fallback) */}
      <input ref={importRef} type="file" accept=".sch,.json" style={{ display: 'none' }} onChange={handleImportDrawing} />
      <input ref={importProjectRef} type="file" accept=".scpro,.json" style={{ display: 'none' }} onChange={handleImportProject} />
      <input ref={attachRef} type="file" style={{ display: 'none' }} onChange={handleAttachFile} />

      {manageOpen && (
        <ManageAttachmentsModal
          attachments={attachments}
          onClose={() => setManageOpen(false)}
          onAttach={handleAttachClick}
          onExport={id => exportAttachment(id)}
          onRemove={id => removeAttachment(id)}
        />
      )}
    </div>
  )
}

function ManageAttachmentsModal({ attachments, onClose, onAttach, onExport, onRemove }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onMouseDown={onClose}
    >
      <div
        className="rounded shadow-xl border w-[480px] max-w-[90vw] max-h-[80vh] flex flex-col"
        style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)', color: 'var(--component-color)' }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--panel-border)' }}>
          <span className="text-sm font-semibold flex items-center gap-2"><Paperclip size={14} /> Attachments</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {attachments.length === 0 ? (
            <div className="text-xs text-gray-400 px-3 py-6 text-center">
              No attachments. Use “Attach File…” to embed datasheets, notes, or reference files in this project.
            </div>
          ) : (
            attachments.map(att => (
              <div
                key={att.id}
                className="flex items-center gap-2 px-3 py-2 rounded hover:bg-black/5 dark:hover:bg-white/5 text-xs"
              >
                <Paperclip size={12} className="text-gray-400 flex-shrink-0" />
                <span className="flex-1 truncate" title={att.name}>{att.name}</span>
                <span className="text-gray-400">{formatBytes(estimateAttachmentBytes(att.data))}</span>
                <button
                  className="px-2 py-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-1"
                  title="Export to disk"
                  onClick={() => onExport(att.id)}
                >
                  <Download size={12} /> Export
                </button>
                <button
                  className="px-1 py-0.5 rounded text-red-400 hover:bg-red-500/10"
                  title="Remove attachment"
                  onClick={() => { if (confirm(`Remove attachment “${att.name}”?`)) onRemove(att.id) }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="px-4 py-3 border-t flex justify-between" style={{ borderColor: 'var(--panel-border)' }}>
          <button
            className="text-xs px-3 py-1.5 rounded border flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/5"
            style={{ borderColor: 'var(--panel-border)' }}
            onClick={onAttach}
          >
            <Paperclip size={12} /> Attach File…
          </button>
          <button
            className="text-xs px-3 py-1.5 rounded border hover:bg-black/5 dark:hover:bg-white/5"
            style={{ borderColor: 'var(--panel-border)' }}
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// Rough decoded-byte size of a base64 payload (3 bytes per 4 chars, minus padding).
function estimateAttachmentBytes(b64) {
  if (typeof b64 !== 'string' || !b64.length) return 0
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor((b64.length * 3) / 4) - padding
}

function MenuItem({ icon, label, shortcut, onClick, disabled, style }) {
  return (
    <button
      className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
      style={style}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="text-gray-400">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-gray-400 text-xs ml-4">{shortcut}</span>}
    </button>
  )
}
