import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  ChevronDown, ChevronRight, FilePlus, Copy, Download, Upload,
  FolderOpen, Save, SaveAll, Clock, X,
} from 'lucide-react'
import useSchematicStore from '../store/schematicStore'
import { isRunningInTauri, basename } from '../lib/tauriFs'

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
  const menuRef = useRef(null)
  const importRef = useRef(null)
  const importProjectRef = useRef(null)

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
  const openProjectFile = useSchematicStore(s => s.openProjectFile)
  const saveProjectFile = useSchematicStore(s => s.saveProjectFile)
  const saveProjectFileAs = useSchematicStore(s => s.saveProjectFileAs)
  const _loadProjectFromPath = useSchematicStore(s => s._loadProjectFromPath)
  const removeRecentFileFn = useSchematicStore(s => s.removeRecentFile)

  const inTauri = isRunningInTauri()

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
        className="flex items-center gap-1 px-2 h-full text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        style={{ color: 'var(--component-color)', height: 36 }}
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

          <MenuItem icon={<FolderOpen size={12} />} label="Manage Projects…"
            onClick={action(() => setShowProjectBrowser(true))} style={menuItemStyle} />
        </div>
      )}

      {/* Hidden file inputs (browser fallback) */}
      <input ref={importRef} type="file" accept=".sch,.json" style={{ display: 'none' }} onChange={handleImportDrawing} />
      <input ref={importProjectRef} type="file" accept=".scpro,.json" style={{ display: 'none' }} onChange={handleImportProject} />
    </div>
  )
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
