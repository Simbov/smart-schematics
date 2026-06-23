import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  ChevronDown, ChevronRight, FilePlus, Copy, Download, Upload,
  FolderOpen, Save, SaveAll, Clock, X, RefreshCw, Paperclip, Trash2, Cpu,
} from 'lucide-react'
import useSchematicStore from '../store/schematicStore'
import { isRunningInTauri, basename, saveFileDialog, writeBinaryFile } from '../lib/tauriFs'
import { checkForUpdates } from '../lib/updater'
import { projectSize, formatBytes, isOverSizeLimit } from '../lib/projectFile'
import { fitImageToArea, titleBlockLayout, pageLabel } from '../lib/pdfExport'
import { inlineComputedColors, boundsFromDrawing } from '../lib/svgExport'

function downloadBlob(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

const blobToBytes = blob =>
  blob.arrayBuffer().then(buf => new Uint8Array(buf))

// Save exported bytes to disk. In Tauri the browser <a download> mechanism does
// NOT write a file (WebView2 has no download manager), so on desktop we must use
// the native save dialog + writeBinaryFile. In a plain browser we fall back to a
// Blob download. Returns true if a file was written, false if cancelled.
// `ext` is the extension (no dot); `mime` is used for the browser Blob.
async function saveExportBytes(bytes, defaultName, ext, mime) {
  if (isRunningInTauri()) {
    const path = await saveFileDialog(defaultName, [{ name: ext.toUpperCase(), extensions: [ext] }])
    if (!path) return false
    await writeBinaryFile(path, bytes)
    return true
  }
  downloadBlob(new Blob([bytes], { type: mime }), defaultName)
  return true
}

// Build an SVG data URL. Data URLs render far more reliably than blob: URLs in
// WebView2 (Windows Tauri), where an <img> pointed at an SVG blob — especially
// one containing <foreignObject> — can fail to fire load *or* error, hanging any
// awaiting export forever.
function svgDataUrl(str) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str)
}

function getSVGElement() {
  return document.querySelector('svg[data-schematic]')
}

// Tight content bounds (world coords) for any drawing — module-level so both the
// active-drawing exports and the multi-page project PDF can reuse it.
// `boundsFromDrawing` now lives in lib/svgExport.js (shared, unit-tested, and
// aware of images/tables/junctions + real component footprints).

// Pick a raster scale so the exported bitmap has enough pixels to look crisp on
// a printed A4 page (~300 DPI) regardless of how small the drawing is in world
// units. A fixed 3× pixelated small drawings when blown up to page size (issue
// #26); this targets ~3200 px on the long edge, clamped to a sane range.
function rasterScale(vbWidth, vbHeight) {
  const longEdge = Math.max(vbWidth || 1, vbHeight || 1)
  return Math.min(12, Math.max(3, Math.ceil(3200 / longEdge)))
}

// Rasterise the live schematic SVG to a high-resolution PNG data URL, trimmed to
// `bounds`. Returns { dataUrl, width, height } (world units) or null. Reused by PDF export.
function captureSvgPng(bounds) {
  return new Promise(resolve => {
    const svgEl = getSVGElement()
    if (!svgEl) return resolve(null)
    const clone = svgEl.cloneNode(true)
    // Resolve CSS-variable colours to concrete values before the clone leaves the
    // document — otherwise wires/strokes lose their var(--…) colour when rendered
    // as a standalone image.
    inlineComputedColors(svgEl, clone)
    const gridG = Array.from(clone.children).find(el => el.tagName === 'g' && !el.hasAttribute('transform'))
    if (gridG) clone.removeChild(gridG)
    const contentG = clone.querySelector('g[transform]')
    if (contentG) contentG.removeAttribute('transform')
    let vbWidth, vbHeight
    if (bounds) {
      vbWidth = bounds.maxX - bounds.minX
      vbHeight = bounds.maxY - bounds.minY
      clone.setAttribute('viewBox', `${bounds.minX} ${bounds.minY} ${vbWidth} ${vbHeight}`)
    } else {
      vbWidth = 800; vbHeight = 600
      clone.setAttribute('viewBox', '0 0 800 600')
    }
    clone.setAttribute('width', vbWidth)
    clone.setAttribute('height', vbHeight)
    clone.removeAttribute('style')
    const scale = rasterScale(vbWidth, vbHeight)
    const str = new XMLSerializer().serializeToString(clone)
    const url = svgDataUrl(str)
    const img = new Image()
    let settled = false
    // Safety net: if the image neither loads nor errors (a real WebView2 failure
    // mode for SVG with foreignObject), resolve null after 20s so the PDF/PNG
    // export reports a clean failure instead of spinning "Building PDF…" forever.
    const timer = setTimeout(() => { if (!settled) { settled = true; resolve(null) } }, 20000)
    img.onload = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      const canvas = document.createElement('canvas')
      canvas.width = vbWidth * scale
      canvas.height = vbHeight * scale
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      resolve({ dataUrl: canvas.toDataURL('image/png'), width: vbWidth, height: vbHeight })
    }
    img.onerror = () => { if (settled) return; settled = true; clearTimeout(timer); resolve(null) }
    img.src = url
  })
}

const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

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
  const setActiveDrawing = useSchematicStore(s => s.setActiveDrawing)
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
  const setExportStatus = useSchematicStore(s => s.setExportStatus)

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

  // Compute tight content bounds for the active drawing (world coords)
  const getContentBounds = useCallback((pad = 30) => boundsFromDrawing(drawing, pad), [drawing])

  const exportSVG = useCallback(async () => {
    const svgEl = getSVGElement()
    if (!svgEl) return
    // Rich-text annotations render via <foreignObject> + XHTML <div>. We clone
    // the live SVG as-is, so the foreignObject (and per-run styling) is carried
    // into the exported .svg — modern viewers render it. AnnotationLayer also
    // draws an opacity-0 plain <text> fallback behind each foreignObject as a
    // safety net for rasterizers that drop foreignObject; it ships in the clone
    // too. We deliberately do not strip either layer here.
    const clone = svgEl.cloneNode(true)
    inlineComputedColors(svgEl, clone)
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
    const bytes = new TextEncoder().encode(str)
    const saved = await saveExportBytes(bytes, `${drawing?.name || 'schematic'}.svg`, 'svg', 'image/svg+xml')
    setExportStatus(saved ? { phase: 'done', label: 'SVG exported' } : null)
  }, [drawing, getContentBounds, setExportStatus])

  const exportPNG = useCallback(() => {
    const svgEl = getSVGElement()
    if (!svgEl) return
    setExportStatus({ phase: 'rendering', label: 'Rendering PNG…' })
    const clone = svgEl.cloneNode(true)
    inlineComputedColors(svgEl, clone)
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
    // PNG always rasterises onto an opaque white background so a dark theme or
    // transparent canvas never bleeds through as a grey/black export.
    const scale = rasterScale(vbWidth, vbHeight)
    const str = new XMLSerializer().serializeToString(clone)
    const url = svgDataUrl(str)
    const img = new Image()
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      setExportStatus({ phase: 'error', label: 'PNG export failed' })
    }, 20000)
    img.onload = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      const canvas = document.createElement('canvas')
      canvas.width = vbWidth * scale
      canvas.height = vbHeight * scale
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(async pngBlob => {
        const bytes = await blobToBytes(pngBlob)
        const saved = await saveExportBytes(bytes, `${drawing?.name || 'schematic'}.png`, 'png', 'image/png')
        setExportStatus(saved ? { phase: 'done', label: 'PNG exported' } : null)
      }, 'image/png')
    }
    img.onerror = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      setExportStatus({ phase: 'error', label: 'PNG export failed' })
    }
    img.src = url
  }, [drawing, getContentBounds, setExportStatus])

  // Draw one captured drawing onto a jsPDF page: artwork fit to the area, with a
  // clean PDF-native title block band along the footer.
  const addPdfPage = useCallback((pdf, capture, { drawingName, projectName, index, total, titleBlock }) => {
    if (capture) {
      const rect = fitImageToArea(capture.width, capture.height)
      pdf.addImage(capture.dataUrl, 'PNG', rect.x, rect.y, rect.w, rect.h)
    }
    // The drawing's own title block is excluded from the captured artwork bounds,
    // so it never appears in the raster — this PDF-native band is the single title
    // block, populated from the drawing's title-block fields when set so it matches
    // what the user entered rather than a generic duplicate (issue #26).
    const tb = titleBlockLayout()
    const tbData = titleBlock || {}
    pdf.setDrawColor(120); pdf.setLineWidth(0.3)
    pdf.rect(tb.x, tb.y, tb.w, tb.h)
    pdf.line(tb.cells[1].x, tb.y, tb.cells[1].x, tb.y + tb.h)
    pdf.line(tb.cells[2].x, tb.y, tb.cells[2].x, tb.y + tb.h)
    const label = (cell, caption, value, big = false) => {
      pdf.setFontSize(6); pdf.setTextColor(130)
      pdf.text(caption, cell.x + 2, tb.y + 4)
      pdf.setFontSize(big ? 12 : 9); pdf.setTextColor(20)
      pdf.text(String(value || '—'), cell.x + 2, tb.y + 12, { maxWidth: cell.w - 4 })
    }
    label(tb.cells[0], 'DRAWING', tbData.title || drawingName, true)
    label(tb.cells[1], 'PROJECT', projectName)
    // Drawing number + author/company as secondary lines under PROJECT when set.
    const sub = [tbData.drawingNumber && `No. ${tbData.drawingNumber}`, tbData.author || tbData.company]
      .filter(Boolean).join('   ')
    if (sub) { pdf.setFontSize(7); pdf.setTextColor(90); pdf.text(sub, tb.cells[1].x + 2, tb.y + 18, { maxWidth: tb.cells[1].w - 4 }) }
    pdf.setFontSize(6); pdf.setTextColor(130)
    pdf.text(`DATE · REV ${tbData.revision || 'A'}`, tb.cells[2].x + 2, tb.y + 4)
    pdf.setFontSize(8); pdf.setTextColor(20)
    pdf.text(String(tbData.date || new Date().toLocaleDateString()), tb.cells[2].x + 2, tb.y + 10)
    pdf.text(pageLabel(index, total), tb.cells[2].x + 2, tb.y + 17)
  }, [])

  // jsPDF is heavy (~130 KB gzip) and rarely the first action — load it on demand.
  const newPdf = async () => {
    const { jsPDF } = await import('jspdf')
    return new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  }

  // Save a finished jsPDF document. jsPDF's own pdf.save() relies on an <a download>
  // click, which silently does nothing in Tauri/WebView2 — so on desktop we route
  // the bytes through the native save dialog instead. Returns true if written.
  const savePdf = async (pdf, defaultName) =>
    saveExportBytes(new Uint8Array(pdf.output('arraybuffer')), defaultName, 'pdf', 'application/pdf')

  const exportPagePdf = useCallback(async () => {
    setExportStatus({ phase: 'rendering', label: 'Building PDF…' })
    try {
      const capture = await captureSvgPng(boundsFromDrawing(drawing, 30))
      const pdf = await newPdf()
      addPdfPage(pdf, capture, { drawingName: drawing?.name, projectName: project?.name, index: 0, total: 1, titleBlock: drawing?.titleBlock })
      const saved = await savePdf(pdf, `${drawing?.name || 'schematic'}.pdf`)
      setExportStatus(saved ? { phase: 'done', label: 'PDF exported' } : null)
    } catch (e) {
      console.error('PDF export failed', e)
      setExportStatus({ phase: 'error', label: 'PDF export failed' })
    }
  }, [drawing, project, addPdfPage, setExportStatus])

  const exportProjectPdf = useCallback(async () => {
    const ordered = (project?.drawingIds || []).map(id => drawings.find(d => d.id === id)).filter(Boolean)
    if (!ordered.length) return
    const restore = activeDrawingId
    try {
      const pdf = await newPdf()
      for (let i = 0; i < ordered.length; i++) {
        const d = ordered[i]
        setExportStatus({ phase: 'rendering', label: `Building PDF — page ${i + 1} of ${ordered.length}…` })
        // Render each drawing into the live canvas, then capture it.
        setActiveDrawing(d.id)
        await nextFrame()
        const capture = await captureSvgPng(boundsFromDrawing(d, 30))
        if (i > 0) pdf.addPage('a4', 'landscape')
        addPdfPage(pdf, capture, { drawingName: d.name, projectName: project?.name, index: i, total: ordered.length, titleBlock: d.titleBlock })
      }
      if (restore) { setActiveDrawing(restore); await nextFrame() }
      const saved = await savePdf(pdf, `${project?.name || 'project'}.pdf`)
      setExportStatus(saved ? { phase: 'done', label: `PDF exported — ${ordered.length} page${ordered.length > 1 ? 's' : ''}` } : null)
    } catch (e) {
      console.error('Project PDF export failed', e)
      if (restore) setActiveDrawing(restore)
      setExportStatus({ phase: 'error', label: 'PDF export failed' })
    }
  }, [project, drawings, activeDrawingId, setActiveDrawing, addPdfPage, setExportStatus])

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
          <MenuItem icon={<Download size={12} />} label="Export Page as PDF"
            onClick={action(exportPagePdf)} disabled={!activeDrawingId} style={menuItemStyle} />
          <MenuItem icon={<Upload size={12} />} label="Import Drawing from JSON"
            onClick={action(() => importRef.current?.click())} style={menuItemStyle} />

          <div style={separatorStyle} />

          {/* Project-level export (browser export remains available) */}
          <MenuItem icon={<Download size={12} />} label="Export Project as JSON"
            onClick={action(() => activeProjectId && exportProjectJSON(activeProjectId))}
            disabled={!activeProjectId} style={menuItemStyle} />
          <MenuItem icon={<Download size={12} />} label="Export Project as PDF"
            onClick={action(exportProjectPdf)} disabled={!activeProjectId} style={menuItemStyle} />
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
