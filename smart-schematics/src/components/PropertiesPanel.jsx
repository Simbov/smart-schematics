import React, { useState, useEffect, useCallback, useRef } from 'react'
import useSchematicStore from '../store/schematicStore'
import useSimulationStore from '../store/simulationStore'
import { getElectricalDef } from '../lib/components/electrical'
import { getHydraulicDef } from '../lib/components/hydraulic'
import { parseValue, formatSI } from '../lib/simulation/parseValue'
import { plainToDoc, applyDocStyle, setDocAlign, docToPlain, docToHtml, isEmptyDoc, emptyDoc } from '../lib/richText'
import { addField, updateField, removeField, moveField } from '../lib/boxFields'
import { addBoxImage, updateBoxImage, removeBoxImage, normalizeBoxImages, moveBoxImage } from '../lib/boxImages'
import { addLink, updateLink, removeLink, moveLink, normalizeUrl } from '../lib/boxLinks'
import { addRow, addCol, removeRow, removeCol } from '../lib/tableModel'
import { RESISTOR_STYLES } from '../lib/resistorStyle'
import Lightbox from './Lightbox'

function getAnyDef(type) { return getElectricalDef(type) || getHydraulicDef(type) }

// Shared compact input styling (used by the box property/image rows).
const INPUT_CLASS = 'rounded px-1 outline-none w-full'
const INPUT_STYLE = {
  fontSize: 11, height: 20,
  background: 'var(--input-bg, rgba(0,0,0,0.06))',
  border: '1px solid var(--panel-border)',
  color: 'var(--component-color)', minWidth: 0,
}

// Style for a quick-style toggle button in the annotation properties.
function qsBtn(active) {
  return {
    minWidth: 22, height: 20, padding: '0 5px', borderRadius: 3, cursor: 'pointer',
    fontSize: 12, lineHeight: 1,
    border: `1px solid ${active ? '#2563eb' : 'var(--panel-border)'}`,
    background: active ? 'rgba(37,99,235,0.15)' : 'var(--input-bg, rgba(0,0,0,0.06))',
    color: 'var(--component-color)',
  }
}

function fmtVal(v, unit) {
  const abs = Math.abs(v)
  if (abs === 0) return `0 ${unit}`
  if (abs >= 1e3)  return `${(v / 1e3).toPrecision(3)} k${unit}`
  if (abs >= 1)    return `${v.toPrecision(3)} ${unit}`
  if (abs >= 1e-3) return `${(v * 1e3).toPrecision(3)} m${unit}`
  if (abs >= 1e-6) return `${(v * 1e6).toPrecision(3)} µ${unit}`
  return `${v.toPrecision(3)} ${unit}`
}


function Field({ label, value, onChange, onBlur, type = 'text', placeholder }) {
  return (
    <div className="flex items-center gap-1 min-w-0">
      <span className="text-gray-400 flex-shrink-0" style={{ fontSize: 10 }}>{label}</span>
      <input
        className="flex-1 min-w-0 rounded px-1 outline-none"
        style={{
          fontSize: 11,
          height: 18,
          background: 'var(--input-bg, rgba(0,0,0,0.06))',
          border: '1px solid var(--panel-border)',
          color: 'var(--component-color)',
          minWidth: 0,
        }}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </div>
  )
}

function SelectField({ label, value, options, onChange }) {
  return (
    <div className="flex items-center gap-1 min-w-0">
      <span className="text-gray-400 flex-shrink-0" style={{ fontSize: 10 }}>{label}</span>
      <select
        className="flex-1 min-w-0 rounded px-1 outline-none"
        style={{
          fontSize: 11,
          height: 18,
          background: 'var(--input-bg, rgba(0,0,0,0.06))',
          border: '1px solid var(--panel-border)',
          color: 'var(--component-color)',
          minWidth: 0,
        }}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

// A titled section with a top divider and an optional right-aligned action
// button (e.g. "+ Add"). Groups related controls so the narrow vertical panel
// reads as a clean, scannable stack rather than one dense run of inputs.
function Section({ title, action, children }) {
  return (
    <div className="pt-2 mt-2 border-t first:border-t-0 first:pt-0 first:mt-0" style={{ borderColor: 'var(--panel-border)' }}>
      <div className="flex items-center justify-between mb-1 min-h-[18px]">
        <span className="text-gray-400 font-semibold uppercase" style={{ fontSize: 9, letterSpacing: '0.06em' }}>{title}</span>
        {action}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

// Small bordered "+ Add" style button used for section actions.
function MiniButton({ children, onClick, title }) {
  return (
    <button
      type="button"
      className="rounded px-2 py-0.5 hover:bg-black/5 dark:hover:bg-white/10"
      style={{ fontSize: 11, border: '1px solid var(--panel-border)', color: 'var(--component-color)', lineHeight: 1.2 }}
      onClick={onClick}
      title={title}
    >{children}</button>
  )
}

// Square red remove button with a guaranteed-visible hit area.
function RemoveButton({ onClick, title }) {
  return (
    <button
      type="button"
      className="flex items-center justify-center rounded text-red-500 hover:bg-red-500/15 flex-shrink-0"
      style={{ width: 22, height: 22, border: '1px solid var(--panel-border)', fontSize: 15, lineHeight: 1 }}
      onClick={onClick}
      title={title}
    >×</button>
  )
}

export default function PropertiesPanel() {
  const selectedIds = useSchematicStore(s => s.selectedIds)
  const activeDrawingId = useSchematicStore(s => s.activeDrawingId)
  const drawing = useSchematicStore(s => s.drawings.find(d => d.id === s.activeDrawingId))
  const pushUndo = useSchematicStore(s => s.pushUndo)
  const updateComponent = useSchematicStore(s => s.updateComponent)
  const updateComponentSimParam = useSchematicStore(s => s.updateComponentSimParam)
  const updateAnnotation = useSchematicStore(s => s.updateAnnotation)
  const updateImage = useSchematicStore(s => s.updateImage)
  const removeImage = useSchematicStore(s => s.removeImage)
  const updateBox = useSchematicStore(s => s.updateBox)
  const updateWire = useSchematicStore(s => s.updateWire)
  const updateTable = useSchematicStore(s => s.updateTable)
  const removeTable = useSchematicStore(s => s.removeTable)

  const isRunning = useSimulationStore(s => s.isRunning)
  const simCompState = useSimulationStore(s => s.componentStates[selectedIds[0]])
  const simWireState = useSimulationStore(s => s.wireStates[selectedIds[0]])

  const [local, setLocal] = useState({ designator: '', value: '', description: '', labelScale: 1, resistorStyle: '' })
  const [localBoxInfo, setLocalBoxInfo] = useState('')
  const [localFields, setLocalFields] = useState([])
  const [localBoxImages, setLocalBoxImages] = useState([])
  const [localSim, setLocalSim] = useState({})
  const [localAnnText, setLocalAnnText] = useState('')
  const [localAnnSize, setLocalAnnSize] = useState(14)
  const [localImg, setLocalImg] = useState({ x: 0, y: 0, width: 0, height: 0, opacity: 1, rotation: 0 })
  const [localBox, setLocalBox] = useState({ width: 80, height: 60, cornerRadius: 4, fill: '#f1f5f9', stroke: '#334155', W: 1, E: 1, N: 0, S: 0 })
  const [localLinks, setLocalLinks] = useState([])
  const [localBoxLabelSize, setLocalBoxLabelSize] = useState(11)
  const [localWire, setLocalWire] = useState({ color: '', style: 'solid', weight: 1 })
  const [localTable, setLocalTable] = useState({ borderColor: '#334155', borderWidth: 1, headerRow: false, fill: '' })
  // Box content view/edit toggle (clean read-only view by default; flip to Edit
  // for textboxes + delete + drag-reorder). Resets to view on selection change.
  const [boxEdit, setBoxEdit] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState(null)
  const [dragRowId, setDragRowId] = useState(null)
  // Resizable panel width, persisted across sessions.
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = Number(localStorage.getItem('propsPanelWidth'))
    return saved >= 240 && saved <= 640 ? saved : 280
  })

  const selected = selectedIds.length === 0 ? null
    : selectedIds.length === 1
      ? (drawing?.components.find(c => c.id === selectedIds[0])
        || drawing?.wires.find(w => w.id === selectedIds[0])
        || (drawing?.annotations || []).find(a => a.id === selectedIds[0])
        || (drawing?.images || []).find(im => im.id === selectedIds[0])
        || (drawing?.tables || []).find(t => t.id === selectedIds[0]))
      : 'multi'

  // Tables carry a `cells` 2-D array; distinguish them before images/wires.
  const isTable = selected && selected !== 'multi' && Array.isArray(selected.cells)
  // Images carry a `src` (and no designator/text), so distinguish them first.
  const isImage = selected && selected !== 'multi' && !isTable && selected.src !== undefined && selected.designator === undefined
  const isAnnotation = selected && selected !== 'multi' && !isImage && !isTable && (selected.type === 'text' || selected.type === 'callout')
  const isComponent = selected && selected !== 'multi' && !isAnnotation && !isImage && !isTable && selected.designator !== undefined
  const isBox = isComponent && selected.type === 'box'
  const isWire = selected && selected !== 'multi' && !isComponent && !isAnnotation && !isImage && !isTable && Array.isArray(selected.points)

  // Sync local state when selection changes
  useEffect(() => {
    if (isComponent) {
      setLocal({
        designator: selected.designator ?? '',
        value: selected.value ?? '',
        description: selected.description ?? '',
        labelScale: selected.labelScale ?? 1,
        resistorStyle: selected.resistorStyle ?? '',
      })
      const def = getAnyDef(selected.type)
      const initSim = { ...(selected.simParams ?? {}) }
      Object.entries(def?.simParams ?? {}).forEach(([key, paramDef]) => {
        if (paramDef.primary && initSim[key] != null && initSim[key] !== '') {
          initSim[key] = formatSI(Number(initSim[key]), paramDef.unit ?? '')
        }
      })
      setLocalSim(initSim)
    }
    if (isAnnotation) {
      const doc = selected.doc || plainToDoc(selected.text ?? '')
      setLocalAnnText(docToPlain(doc))
      setLocalAnnSize(doc.paragraphs?.[0]?.runs?.[0]?.fontSize ?? (selected.fontSize ?? 14))
    }
    if (isImage) {
      setLocalImg({
        x: selected.x ?? 0,
        y: selected.y ?? 0,
        width: selected.width ?? 0,
        height: selected.height ?? 0,
        opacity: selected.opacity ?? 1,
        rotation: selected.rotation ?? 0,
      })
    }
    if (isBox) {
      const b = selected.box || {}
      const counts = { W: 0, E: 0, N: 0, S: 0 }
      for (const p of (selected.pins || [])) if (p.direction in counts) counts[p.direction]++
      setLocalBox({
        width: b.width ?? 80,
        height: b.height ?? 60,
        cornerRadius: b.cornerRadius ?? 4,
        fill: b.fill ?? '#f1f5f9',
        stroke: b.stroke ?? '#334155',
        ...counts,
      })
      setLocalBoxInfo(b.info ?? '')
      setLocalFields(b.fields ?? [])
      setLocalBoxImages(normalizeBoxImages(b))
      setLocalLinks(b.links ?? [])
      const firstRun = (b.doc?.paragraphs || []).flatMap(p => p.runs || []).find(r => r.text)
      setLocalBoxLabelSize(firstRun?.fontSize ?? 11)
    }
    if (isWire) {
      setLocalWire({
        color: selected.color ?? '',
        style: selected.style ?? 'solid',
        weight: selected.weight ?? 1,
      })
    }
    if (isTable) {
      setLocalTable({
        borderColor: selected.borderColor ?? '#334155',
        borderWidth: selected.borderWidth ?? 1,
        headerRow: !!selected.headerRow,
        fill: selected.fill ?? '',
      })
    }
    setBoxEdit(false)
  }, [selectedIds[0]])

  const commitField = useCallback((field, val) => {
    if (!isComponent) return
    pushUndo()
    updateComponent(activeDrawingId, selected.id, { [field]: val })
  }, [isComponent, activeDrawingId, selected?.id])

  const commitSimParam = useCallback((key, val) => {
    if (!isComponent) return
    const def = getAnyDef(selected.type)
    const paramDef = def?.simParams?.[key]
    let stored = val
    if (paramDef?.primary) {
      const num = parseValue(String(val), paramDef.default)
      stored = num
      setLocalSim(s => ({ ...s, [key]: formatSI(num, paramDef.unit ?? '') }))
    }
    pushUndo()
    updateComponentSimParam(activeDrawingId, selected.id, key, stored)
  }, [isComponent, activeDrawingId, selected?.id, selected?.type])

  // The current doc for the selected annotation (tolerates legacy text-only).
  const annDoc = isAnnotation ? (selected.doc || plainToDoc(selected.text ?? '')) : null

  // Derive whether a boolean run-attr is uniformly set across all non-empty runs.
  const docHasAll = useCallback((attr) => {
    if (!annDoc) return false
    const runs = annDoc.paragraphs.flatMap(p => p.runs || []).filter(r => r.text)
    return runs.length > 0 && runs.every(r => r[attr])
  }, [annDoc])

  // Plain-text edit: rebuild the doc from the textarea, preserving the uniform
  // style of the first run (so a whole-box-bold box stays bold after a text edit).
  const commitAnnotationText = useCallback((val) => {
    if (!isAnnotation) return
    const firstRun = annDoc?.paragraphs?.[0]?.runs?.[0]
    let doc = plainToDoc(val)
    if (firstRun) {
      const carry = {}
      if (firstRun.bold) carry.bold = true
      if (firstRun.italic) carry.italic = true
      if (firstRun.underline) carry.underline = true
      if (firstRun.color) carry.color = firstRun.color
      if (firstRun.fontSize) carry.fontSize = firstRun.fontSize
      doc = applyDocStyle(doc, carry)
    }
    doc = setDocAlign(doc, annDoc?.align || 'left')
    pushUndo()
    updateAnnotation(activeDrawingId, selected.id, { doc })
  }, [isAnnotation, activeDrawingId, selected?.id, annDoc, pushUndo])

  // Whole-box quick style: patch every run.
  const commitDocStyle = useCallback((patch) => {
    if (!isAnnotation) return
    pushUndo()
    updateAnnotation(activeDrawingId, selected.id, { doc: applyDocStyle(annDoc, patch) })
  }, [isAnnotation, activeDrawingId, selected?.id, annDoc, pushUndo])

  const commitDocAlign = useCallback((align) => {
    if (!isAnnotation) return
    pushUndo()
    updateAnnotation(activeDrawingId, selected.id, { doc: setDocAlign(annDoc, align) })
  }, [isAnnotation, activeDrawingId, selected?.id, annDoc, pushUndo])

  const commitImageField = useCallback((patch) => {
    if (!isImage) return
    pushUndo()
    updateImage(activeDrawingId, selected.id, patch)
  }, [isImage, activeDrawingId, selected?.id])

  // Box style/geometry commit (grid-snapping + pin re-derivation handled by the
  // store's updateBox). Geometry changes recompute pins; pin-count changes pass a
  // pinSpec so updateBox rebuilds the edges.
  const commitBox = useCallback((boxPatch, pinSpec = null) => {
    if (!isBox) return
    pushUndo()
    updateBox(activeDrawingId, selected.id, boxPatch, pinSpec)
  }, [isBox, activeDrawingId, selected?.id, pushUndo, updateBox])

  const commitBoxPins = useCallback((counts) => {
    if (!isBox) return
    const spec = { W: counts.W, E: counts.E, N: counts.N, S: counts.S }
    pushUndo()
    updateBox(activeDrawingId, selected.id, {}, spec)
  }, [isBox, activeDrawingId, selected?.id, pushUndo, updateBox])

  const replaceInputRef = useRef(null)
  const onReplaceImage = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !isImage) return
    const reader = new FileReader()
    reader.onload = () => commitImageField({ src: reader.result })
    reader.readAsDataURL(file)
  }

  // Box reference images (v0.2.0): panel-only documentation pictures. Reading a
  // file appends it to box.images (NOT drawn on the canvas). Multiple images are
  // supported, each filed under an editable heading.
  const boxImageInputRef = useRef(null)
  const commitBoxImages = useCallback((next) => {
    if (!isBox) return
    setLocalBoxImages(next)
    commitBox({ images: next })
  }, [isBox, commitBox])
  const onAssignBoxImage = (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length || !isBox) return
    // Read all chosen files, then append them in one commit.
    Promise.all(files.map(file => new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    }))).then(srcs => {
      let next = localBoxImages
      for (const src of srcs) if (src) next = addBoxImage(next, { src, heading: '' })
      commitBoxImages(next)
    })
  }

  // Commit a single box pin's label without rebuilding the pin layout.
  const commitPinLabel = useCallback((pinId, label) => {
    if (!isBox) return
    const pins = (selected.pins || []).map(p => p.id === pinId ? { ...p, label } : p)
    pushUndo()
    updateComponent(activeDrawingId, selected.id, { pins })
  }, [isBox, activeDrawingId, selected, pushUndo, updateComponent])

  // ── Box label whole-doc quick styles (fixes "font size not working on boxes":
  // the panel now sizes/styles the ENTIRE box label, not just an editor range).
  const boxDoc = isBox ? (selected.box?.doc || emptyDoc()) : null
  const boxDocHasAll = useCallback((attr) => {
    if (!boxDoc) return false
    const runs = boxDoc.paragraphs.flatMap(p => p.runs || []).filter(r => r.text)
    return runs.length > 0 && runs.every(r => r[attr])
  }, [boxDoc])
  const boxDocSize = boxDoc?.paragraphs?.flatMap(p => p.runs || []).find(r => r.text)?.fontSize ?? 11
  const commitBoxDocStyle = useCallback((patch) => {
    if (!isBox) return
    commitBox({ doc: applyDocStyle(boxDoc, patch) })
  }, [isBox, boxDoc, commitBox])
  const commitBoxDocAlign = useCallback((align) => {
    if (!isBox) return
    commitBox({ doc: setDocAlign(boxDoc, align) })
  }, [isBox, boxDoc, commitBox])

  // ── Box links (panel-only clickable references).
  const commitLinks = useCallback((next) => {
    if (!isBox) return
    setLocalLinks(next)
    commitBox({ links: next })
  }, [isBox, commitBox])

  // ── Generic drag-to-reorder for the box content rows. Each section commits a
  // reordered array via its move* helper when a row is dropped onto another.
  const reorderDrop = useCallback((kind, toId) => {
    const fromId = dragRowId
    setDragRowId(null)
    if (!fromId || fromId === toId) return
    if (kind === 'field') { const next = moveField(localFields, fromId, toId); setLocalFields(next); commitBox({ fields: next }) }
    else if (kind === 'image') commitBoxImages(moveBoxImage(localBoxImages, fromId, toId))
    else if (kind === 'link') commitLinks(moveLink(localLinks, fromId, toId))
  }, [dragRowId, localFields, localBoxImages, localLinks, commitBox, commitBoxImages, commitLinks])

  // ── Paste an image from the clipboard straight into the box's reference images.
  const onBoxPaste = useCallback((e) => {
    if (!isBox) return
    const items = e.clipboardData?.items
    if (!items) return
    for (const it of items) {
      if (it.type && it.type.startsWith('image/')) {
        const file = it.getAsFile()
        if (!file) continue
        e.preventDefault()
        e.stopPropagation()
        const reader = new FileReader()
        reader.onload = () => commitBoxImages(addBoxImage(localBoxImages, { src: reader.result, heading: '' }))
        reader.readAsDataURL(file)
        return
      }
    }
  }, [isBox, localBoxImages, commitBoxImages])

  const pasteImageFromClipboard = useCallback(async () => {
    if (!isBox || !navigator.clipboard?.read) return
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find(t => t.startsWith('image/'))
        if (!type) continue
        const blob = await item.getType(type)
        const reader = new FileReader()
        reader.onload = () => commitBoxImages(addBoxImage(localBoxImages, { src: reader.result, heading: '' }))
        reader.readAsDataURL(blob)
        return
      }
    } catch { /* clipboard unreadable / denied — ignore */ }
  }, [isBox, localBoxImages, commitBoxImages])

  // ── Wire styling.
  const commitWire = useCallback((patch) => {
    if (!isWire) return
    pushUndo()
    updateWire(activeDrawingId, selected.id, patch)
  }, [isWire, activeDrawingId, selected?.id, pushUndo, updateWire])

  // ── Table structure + styling. Structural ops go through tableModel helpers
  // (which keep cells/colWidths/rowHeights rectangular) then patch the whole table.
  const commitTable = useCallback((patch) => {
    if (!isTable) return
    pushUndo()
    updateTable(activeDrawingId, selected.id, patch)
  }, [isTable, activeDrawingId, selected?.id, pushUndo, updateTable])
  const applyTableOp = useCallback((fn) => {
    if (!isTable) return
    const next = fn(selected)
    const { id, x, y, ...rest } = next
    commitTable(rest)
  }, [isTable, selected, commitTable])

  const def = isComponent ? getAnyDef(selected.type) : null
  const simParamDefs = def?.simParams ?? {}
  const hasSimParams = Object.keys(simParamDefs).length > 0
  const hasPrimaryParam = Object.values(simParamDefs).some(p => p.primary)

  return (
    <div
      className="border-l flex-shrink-0 flex flex-col relative"
      style={{
        background: 'var(--panel-bg)',
        borderColor: 'var(--panel-border)',
        overflowY: 'auto',
        overflowX: 'hidden',
        width: panelWidth,
        height: '100%',
      }}
    >
      {/* Drag the left edge to resize the panel (width persisted). */}
      <div
        title="Drag to resize"
        onMouseDown={(e) => {
          e.preventDefault()
          const startX = e.clientX
          const startW = panelWidth
          const onMove = (ev) => {
            const next = Math.min(640, Math.max(240, startW + (startX - ev.clientX)))
            setPanelWidth(next)
          }
          const onUp = () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
            setPanelWidth(w => { localStorage.setItem('propsPanelWidth', String(w)); return w })
          }
          window.addEventListener('mousemove', onMove)
          window.addEventListener('mouseup', onUp)
        }}
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 5 }}
      />
      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      <div
        className="px-3 py-1 border-b text-xs font-semibold uppercase tracking-wide text-gray-500 sticky top-0"
        style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-bg)' }}
      >
        Properties
      </div>

      <div className="px-3 py-2" style={{ color: 'var(--component-color)' }}>
        {/* Nothing / multi-select */}
        {!selected && (
          <span className="text-gray-400" style={{ fontSize: 11 }}>Nothing selected</span>
        )}
        {selected === 'multi' && (
          <span className="text-gray-400" style={{ fontSize: 11 }}>{selectedIds.length} items selected</span>
        )}

        {/* Wire selected */}
        {isWire && (
          <div className="space-y-1.5" style={{ fontSize: 11 }}>
            <div>
              <span className="text-gray-400">Type: </span>Wire
              {selected.netLabel && (
                <span className="ml-3"><span className="text-gray-400">Net: </span>{selected.netLabel}</span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1" title="Wire color">
                <span className="text-gray-400" style={{ fontSize: 10 }}>Color</span>
                <input
                  type="color"
                  value={localWire.color || '#1e293b'}
                  onChange={e => { setLocalWire(w => ({ ...w, color: e.target.value })); commitWire({ color: e.target.value }) }}
                  style={{ width: 28, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                />
              </label>
              {localWire.color && (
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 hover:bg-black/5 dark:hover:bg-white/10"
                  style={{ fontSize: 10, border: '1px solid var(--panel-border)', color: 'var(--component-color)' }}
                  onClick={() => { setLocalWire(w => ({ ...w, color: '' })); commitWire({ color: undefined }) }}
                  title="Use the default theme wire color"
                >Default</button>
              )}
            </div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
              <SelectField label="Style" value={localWire.style}
                options={['solid', 'dashed', 'dotted']}
                onChange={v => { setLocalWire(w => ({ ...w, style: v })); commitWire({ style: v }) }} />
              <Field label="Weight" type="number" value={localWire.weight}
                onChange={v => setLocalWire(w => ({ ...w, weight: Number(v) }))}
                onBlur={() => commitWire({ weight: Math.max(0.5, Number(localWire.weight) || 1) })} />
            </div>
            {isRunning && simWireState && (
              <div className="mt-1 flex gap-3 flex-wrap" style={{ fontSize: 11 }}>
                <span><span className="text-gray-400">V: </span>{fmtVal(simWireState.voltage ?? 0, 'V')}</span>
                {Math.abs(simWireState.current ?? 0) > 1e-6 && (
                  <span><span className="text-gray-400">I: </span>{fmtVal(simWireState.current, 'A')}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Table selected — structure + styling */}
        {isTable && (
          <div className="space-y-1.5" style={{ fontSize: 11 }}>
            <div><span className="text-gray-400">Type: </span>Table ({selected.rows}×{selected.cols})</div>
            <Section title="Structure">
              <div className="grid gap-1.5" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <MiniButton title="Add a row at the bottom" onClick={() => applyTableOp(t => addRow(t))}>+ Row</MiniButton>
                <MiniButton title="Add a column on the right" onClick={() => applyTableOp(t => addCol(t))}>+ Column</MiniButton>
                <MiniButton title="Remove the last row" onClick={() => applyTableOp(t => removeRow(t, t.rows - 1))}>− Row</MiniButton>
                <MiniButton title="Remove the last column" onClick={() => applyTableOp(t => removeCol(t, t.cols - 1))}>− Column</MiniButton>
              </div>
              <label className="flex items-center gap-1.5" style={{ fontSize: 11 }}>
                <input type="checkbox" checked={localTable.headerRow}
                  onChange={e => { setLocalTable(t => ({ ...t, headerRow: e.target.checked })); commitTable({ headerRow: e.target.checked }) }} />
                <span className="text-gray-400" style={{ fontSize: 10 }}>Header row (tinted first row)</span>
              </label>
            </Section>
            <Section title="Style">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-1" title="Border color">
                  <span className="text-gray-400" style={{ fontSize: 10 }}>Border</span>
                  <input type="color" value={localTable.borderColor || '#334155'}
                    onChange={e => { setLocalTable(t => ({ ...t, borderColor: e.target.value })); commitTable({ borderColor: e.target.value }) }}
                    style={{ width: 28, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }} />
                </label>
                <label className="flex items-center gap-1" title="Cell/background fill">
                  <span className="text-gray-400" style={{ fontSize: 10 }}>Fill</span>
                  <input type="color" value={localTable.fill || '#ffffff'}
                    onChange={e => { setLocalTable(t => ({ ...t, fill: e.target.value })); commitTable({ fill: e.target.value }) }}
                    style={{ width: 28, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }} />
                  {localTable.fill && (
                    <button type="button" className="text-red-500" title="Clear fill"
                      style={{ fontSize: 13, lineHeight: 1 }}
                      onClick={() => { setLocalTable(t => ({ ...t, fill: '' })); commitTable({ fill: null }) }}>×</button>
                  )}
                </label>
              </div>
              <Field label="Line weight" type="number" value={localTable.borderWidth}
                onChange={v => setLocalTable(t => ({ ...t, borderWidth: Number(v) }))}
                onBlur={() => commitTable({ borderWidth: Math.max(0.25, Number(localTable.borderWidth) || 1) })} />
            </Section>
            <button
              className="rounded px-2 py-0.5 text-red-500"
              style={{ fontSize: 11, border: '1px solid var(--panel-border)' }}
              onClick={() => { pushUndo(); removeTable(activeDrawingId, selected.id) }}
            >Delete table</button>
          </div>
        )}

        {/* Annotation selected — whole-box quick styles; fine per-run styling
            is done in the floating inline editor (double-click on canvas). */}
        {isAnnotation && (
          <div className="space-y-1.5">
            <div>
              <span className="text-gray-400 block mb-0.5" style={{ fontSize: 10 }}>
                {selected.type === 'callout' ? 'Callout text (double-click on canvas for rich editing)' : 'Text (double-click on canvas for rich editing)'}
              </span>
              <textarea
                className="w-full rounded px-1 outline-none resize-y"
                style={{
                  fontSize: 11,
                  minHeight: 36,
                  maxHeight: 80,
                  background: 'var(--input-bg, rgba(0,0,0,0.06))',
                  border: '1px solid var(--panel-border)',
                  color: 'var(--component-color)',
                  display: 'block',
                }}
                value={localAnnText}
                onChange={e => setLocalAnnText(e.target.value)}
                onBlur={() => commitAnnotationText(localAnnText)}
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 11 }}>
              <Field
                label="Size"
                type="number"
                value={localAnnSize}
                onChange={v => setLocalAnnSize(v)}
                onBlur={() => {
                  const n = Number(localAnnSize)
                  if (n > 0) commitDocStyle({ fontSize: n })
                }}
              />
              <button
                type="button"
                title="Bold (whole box)"
                onClick={() => commitDocStyle({ bold: !docHasAll('bold') })}
                style={qsBtn(docHasAll('bold'))}
              ><b>B</b></button>
              <button
                type="button"
                title="Italic (whole box)"
                onClick={() => commitDocStyle({ italic: !docHasAll('italic') })}
                style={qsBtn(docHasAll('italic'))}
              ><i>I</i></button>
              <button
                type="button"
                title="Underline (whole box)"
                onClick={() => commitDocStyle({ underline: !docHasAll('underline') })}
                style={qsBtn(docHasAll('underline'))}
              ><u>U</u></button>
              <label className="flex items-center gap-1" title="Text color (whole box)">
                <span className="text-gray-400" style={{ fontSize: 10 }}>Color</span>
                <input
                  type="color"
                  value={annDoc?.paragraphs?.[0]?.runs?.[0]?.color || '#000000'}
                  onChange={e => commitDocStyle({ color: e.target.value })}
                  style={{ width: 22, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                />
              </label>
            </div>
            <div className="flex items-center gap-2" style={{ fontSize: 11 }}>
              <span className="text-gray-400" style={{ fontSize: 10 }}>Align</span>
              {['left', 'center', 'right'].map(a => (
                <button
                  key={a}
                  type="button"
                  title={`Align ${a}`}
                  onClick={() => commitDocAlign(a)}
                  style={qsBtn(annDoc?.align === a)}
                >{a === 'left' ? '⬅' : a === 'center' ? '↔' : '➡'}</button>
              ))}
            </div>
          </div>
        )}

        {/* Image selected */}
        {isImage && (
          <div className="space-y-1.5">
            <input ref={replaceInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onReplaceImage} />
            <img src={selected.src} alt="selected image" title="Click to enlarge"
              onClick={() => setLightboxSrc(selected.src)}
              style={{ display: 'block', maxWidth: '100%', maxHeight: 140, margin: '0 auto', borderRadius: 3, cursor: 'zoom-in', background: 'rgba(0,0,0,0.04)' }} />
            <div className="grid gap-1.5" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
              <Field label="X" type="number" value={localImg.x}
                onChange={v => setLocalImg(i => ({ ...i, x: Number(v) }))}
                onBlur={() => commitImageField({ x: localImg.x })} />
              <Field label="Y" type="number" value={localImg.y}
                onChange={v => setLocalImg(i => ({ ...i, y: Number(v) }))}
                onBlur={() => commitImageField({ y: localImg.y })} />
              <Field label="W" type="number" value={localImg.width}
                onChange={v => setLocalImg(i => ({ ...i, width: Number(v) }))}
                onBlur={() => commitImageField({ width: Math.max(1, localImg.width) })} />
              <Field label="H" type="number" value={localImg.height}
                onChange={v => setLocalImg(i => ({ ...i, height: Number(v) }))}
                onBlur={() => commitImageField({ height: Math.max(1, localImg.height) })} />
            </div>
            <div className="grid gap-1.5 items-center" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <Field label="Opacity" type="number" value={localImg.opacity}
                onChange={v => setLocalImg(i => ({ ...i, opacity: Number(v) }))}
                onBlur={() => commitImageField({ opacity: Math.min(1, Math.max(0, localImg.opacity)) })} />
              <SelectField label="Rotate" value={String(localImg.rotation)}
                options={['0', '90', '180', '270']}
                onChange={v => { const r = Number(v); setLocalImg(i => ({ ...i, rotation: r })); commitImageField({ rotation: r }) }} />
              <div className="flex items-center gap-1">
                <span className="text-gray-400 flex-shrink-0" style={{ fontSize: 10 }}>Lock</span>
                <input type="checkbox" checked={!!selected.locked}
                  onChange={e => commitImageField({ locked: e.target.checked })} />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded px-2 py-0.5"
                style={{ fontSize: 11, border: '1px solid var(--panel-border)', color: 'var(--component-color)' }}
                onClick={() => replaceInputRef.current?.click()}
              >Replace image…</button>
              <button
                className="rounded px-2 py-0.5 text-red-500"
                style={{ fontSize: 11, border: '1px solid var(--panel-border)' }}
                onClick={() => { pushUndo(); removeImage(activeDrawingId, selected.id) }}
              >Delete</button>
            </div>
          </div>
        )}

        {/* Component selected */}
        {isComponent && (
          <div className="space-y-1.5">
            {/* Basic fields row */}
            <div className="grid gap-1.5" style={{ gridTemplateColumns: (hasPrimaryParam || isBox) ? '1fr 1.5fr' : '1fr 1fr 1.5fr' }}>
              <Field
                label="Ref"
                value={local.designator}
                onChange={v => setLocal(l => ({ ...l, designator: v }))}
                onBlur={() => commitField('designator', local.designator)}
                placeholder="R1"
              />
              {/* Generic Value is hidden for boxes (they use flexible fields) and
                  for components with a primary sim param (e.g. resistance). */}
              {!hasPrimaryParam && !isBox && (
                <Field
                  label="Value"
                  value={local.value}
                  onChange={v => setLocal(l => ({ ...l, value: v }))}
                  onBlur={() => commitField('value', local.value)}
                  placeholder="1kΩ"
                />
              )}
              <Field
                label="Desc"
                value={local.description}
                onChange={v => setLocal(l => ({ ...l, description: v }))}
                onBlur={() => commitField('description', local.description)}
                placeholder="Description"
              />
            </div>

            {/* Ref label size + (resistors) symbol style */}
            <div className="grid gap-1.5 items-center" style={{ gridTemplateColumns: selected.type === 'resistor' ? '1fr 1fr' : '1fr' }}>
              <Field
                label="Ref size"
                type="number"
                value={local.labelScale}
                onChange={v => setLocal(l => ({ ...l, labelScale: v }))}
                onBlur={() => {
                  const n = Number(local.labelScale)
                  if (n > 0) commitField('labelScale', n)
                }}
              />
              {selected.type === 'resistor' && (
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-gray-400 flex-shrink-0" style={{ fontSize: 10 }}>Symbol</span>
                  <select
                    className="flex-1 min-w-0 rounded px-1 outline-none"
                    style={{ fontSize: 11, height: 18, background: 'var(--input-bg, rgba(0,0,0,0.06))', border: '1px solid var(--panel-border)', color: 'var(--component-color)' }}
                    value={local.resistorStyle}
                    onChange={e => {
                      const v = e.target.value
                      setLocal(l => ({ ...l, resistorStyle: v }))
                      commitField('resistorStyle', v || undefined)
                    }}
                  >
                    <option value="">Default</option>
                    {RESISTOR_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Box editor (Stage 5 + v0.2.0): grouped into scannable sections so
                the narrow vertical rail stays readable. */}
            {isBox && (
              <div onPaste={onBoxPaste}>
                {/* Appearance — geometry + colours. */}
                <Section title="Appearance">
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <Field label="W" type="number" value={localBox.width}
                      onChange={v => setLocalBox(b => ({ ...b, width: Number(v) }))}
                      onBlur={() => commitBox({ width: Math.max(10, localBox.width) })} />
                    <Field label="H" type="number" value={localBox.height}
                      onChange={v => setLocalBox(b => ({ ...b, height: Number(v) }))}
                      onBlur={() => commitBox({ height: Math.max(10, localBox.height) })} />
                    <Field label="R" type="number" value={localBox.cornerRadius}
                      onChange={v => setLocalBox(b => ({ ...b, cornerRadius: Number(v) }))}
                      onBlur={() => commitBox({ cornerRadius: Math.max(0, localBox.cornerRadius) })} />
                  </div>
                  <div className="flex items-center gap-4" style={{ fontSize: 11 }}>
                    <label className="flex items-center gap-1" title="Fill color">
                      <span className="text-gray-400" style={{ fontSize: 10 }}>Fill</span>
                      <input type="color" value={localBox.fill}
                        onChange={e => { setLocalBox(b => ({ ...b, fill: e.target.value })); commitBox({ fill: e.target.value }) }}
                        style={{ width: 28, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }} />
                    </label>
                    <label className="flex items-center gap-1" title="Stroke color">
                      <span className="text-gray-400" style={{ fontSize: 10 }}>Stroke</span>
                      <input type="color" value={localBox.stroke}
                        onChange={e => { setLocalBox(b => ({ ...b, stroke: e.target.value })); commitBox({ stroke: e.target.value }) }}
                        style={{ width: 28, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }} />
                    </label>
                  </div>
                </Section>

                {/* Label — whole-box rich-text quick styles. Sizing here applies to
                    the ENTIRE label (the fix for "font size not working on boxes"). */}
                <Section title="Label">
                  <div className="text-gray-400" style={{ fontSize: 10 }}>Double-click the box on the canvas to edit its label text.</div>
                  <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 11 }}>
                    <Field label="Size" type="number" value={localBoxLabelSize}
                      onChange={v => setLocalBoxLabelSize(v)}
                      onBlur={() => { const n = Number(localBoxLabelSize); if (n > 0) commitBoxDocStyle({ fontSize: n }) }} />
                    <button type="button" title="Bold (whole label)"
                      onClick={() => commitBoxDocStyle({ bold: !boxDocHasAll('bold') })} style={qsBtn(boxDocHasAll('bold'))}><b>B</b></button>
                    <button type="button" title="Italic (whole label)"
                      onClick={() => commitBoxDocStyle({ italic: !boxDocHasAll('italic') })} style={qsBtn(boxDocHasAll('italic'))}><i>I</i></button>
                    <button type="button" title="Underline (whole label)"
                      onClick={() => commitBoxDocStyle({ underline: !boxDocHasAll('underline') })} style={qsBtn(boxDocHasAll('underline'))}><u>U</u></button>
                    <label className="flex items-center gap-1" title="Label color (whole label)">
                      <span className="text-gray-400" style={{ fontSize: 10 }}>Color</span>
                      <input type="color"
                        value={boxDoc?.paragraphs?.flatMap(p => p.runs || []).find(r => r.text)?.color || '#0f172a'}
                        onChange={e => commitBoxDocStyle({ color: e.target.value })}
                        style={{ width: 22, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }} />
                    </label>
                  </div>
                  <div className="flex items-center gap-2" style={{ fontSize: 11 }}>
                    <span className="text-gray-400" style={{ fontSize: 10 }}>Align</span>
                    {['left', 'center', 'right'].map(a => (
                      <button key={a} type="button" title={`Align ${a}`}
                        onClick={() => commitBoxDocAlign(a)} style={qsBtn(boxDoc?.align === a)}>
                        {a === 'left' ? '⬅' : a === 'center' ? '↔' : '➡'}
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Pins — per-side counts + per-pin labels. */}
                <Section title="Pins">
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                    {['W', 'E', 'N', 'S'].map(side => (
                      <Field key={side} label={side} type="number" value={localBox[side]}
                        onChange={v => setLocalBox(b => ({ ...b, [side]: Math.max(0, Math.round(Number(v) || 0)) }))}
                        onBlur={() => commitBoxPins({ ...localBox })} />
                    ))}
                  </div>
                  {(selected.pins || []).length > 0 && (
                    <div className="space-y-1">
                      <div className="text-gray-400" style={{ fontSize: 10 }}>Pin labels</div>
                      <div className="grid gap-1" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        {(selected.pins || []).map(p => (
                          <div key={`${selected.id}-${p.id}`} className="flex items-center gap-1 min-w-0">
                            <span className="text-gray-400 flex-shrink-0" style={{ fontSize: 10, width: 18 }}>{p.id}</span>
                            <input className={INPUT_CLASS} style={INPUT_STYLE} placeholder="label"
                              defaultValue={p.label ?? ''}
                              onBlur={e => commitPinLabel(p.id, e.target.value)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Section>

                {/* Documentation content — clean read-only view by default; the
                    Edit toggle reveals textboxes + delete + drag-reorder. */}
                <input ref={boxImageInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onAssignBoxImage} />
                <div className="pt-2 mt-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--panel-border)' }}>
                  <span className="text-gray-400 font-semibold uppercase" style={{ fontSize: 9, letterSpacing: '0.06em' }}>Documentation</span>
                  <MiniButton title={boxEdit ? 'Finish editing' : 'Edit properties, images & links'}
                    onClick={() => setBoxEdit(e => !e)}>{boxEdit ? 'Done' : 'Edit'}</MiniButton>
                </div>

                {/* Properties */}
                {(localFields.length > 0 || boxEdit) && (
                  <Section title="Properties">
                    {boxEdit ? (
                      localFields.map(f => (
                        <div key={f.id}
                          onDragOver={e => e.preventDefault()} onDrop={() => reorderDrop('field', f.id)}
                          className="rounded p-1.5 space-y-1" style={{ border: '1px solid var(--panel-border)', opacity: dragRowId === f.id ? 0.5 : 1 }}>
                          <div className="flex items-center gap-1">
                            <span draggable onDragStart={() => setDragRowId(f.id)} onDragEnd={() => setDragRowId(null)}
                              title="Drag to reorder" style={{ cursor: 'grab', fontSize: 12, color: 'var(--panel-border)', userSelect: 'none' }}>⠿</span>
                            <input className={INPUT_CLASS} style={{ ...INPUT_STYLE, flex: 1 }}
                              placeholder="Property name" defaultValue={f.label}
                              onBlur={e => { const next = updateField(localFields, f.id, { label: e.target.value }); setLocalFields(next); commitBox({ fields: next }) }} />
                            <RemoveButton title="Remove this property"
                              onClick={() => { const next = removeField(localFields, f.id); setLocalFields(next); commitBox({ fields: next }) }} />
                          </div>
                          <div className="grid gap-1" style={{ gridTemplateColumns: '2fr 1fr' }}>
                            <input className={INPUT_CLASS} style={INPUT_STYLE}
                              placeholder="Value" defaultValue={f.value}
                              onBlur={e => { const next = updateField(localFields, f.id, { value: e.target.value }); setLocalFields(next); commitBox({ fields: next }) }} />
                            <input className={INPUT_CLASS} style={INPUT_STYLE}
                              placeholder="Unit" defaultValue={f.unit}
                              onBlur={e => { const next = updateField(localFields, f.id, { unit: e.target.value }); setLocalFields(next); commitBox({ fields: next }) }} />
                          </div>
                        </div>
                      ))
                    ) : (
                      localFields.map(f => (
                        <div key={f.id} className="flex justify-between gap-2" style={{ fontSize: 11 }}>
                          <span className="text-gray-400 flex-shrink-0">{f.label || '—'}</span>
                          <span className="text-right" style={{ wordBreak: 'break-word' }}>{f.value}{f.unit ? ` ${f.unit}` : ''}</span>
                        </div>
                      ))
                    )}
                  </Section>
                )}

                {/* Reference images — panel-only documentation (not drawn on canvas). */}
                {(localBoxImages.length > 0 || boxEdit) && (
                  <Section title="Images">
                    {boxEdit && (
                      <div className="text-gray-400" style={{ fontSize: 10 }}>Reference only — not drawn on the schematic. Paste (⌘/Ctrl-V) an image here too.</div>
                    )}
                    {localBoxImages.map(im => (
                      boxEdit ? (
                        <div key={im.id}
                          onDragOver={e => e.preventDefault()} onDrop={() => reorderDrop('image', im.id)}
                          className="space-y-1 rounded p-1.5" style={{ border: '1px solid var(--panel-border)', opacity: dragRowId === im.id ? 0.5 : 1 }}>
                          <div className="flex items-center gap-1">
                            <span draggable onDragStart={() => setDragRowId(im.id)} onDragEnd={() => setDragRowId(null)}
                              title="Drag to reorder" style={{ cursor: 'grab', fontSize: 12, color: 'var(--panel-border)', userSelect: 'none' }}>⠿</span>
                            <input className={INPUT_CLASS} style={{ ...INPUT_STYLE, flex: 1 }}
                              placeholder="Heading (e.g. Pinout)" defaultValue={im.heading}
                              onBlur={e => commitBoxImages(updateBoxImage(localBoxImages, im.id, { heading: e.target.value }))} />
                            <RemoveButton title="Remove this image"
                              onClick={() => commitBoxImages(removeBoxImage(localBoxImages, im.id))} />
                          </div>
                          <img src={im.src} alt={im.heading || 'reference image'} title="Click to enlarge"
                            onClick={() => setLightboxSrc(im.src)}
                            style={{ display: 'block', maxWidth: '100%', maxHeight: 160, margin: '0 auto', borderRadius: 3, cursor: 'zoom-in', background: 'rgba(0,0,0,0.04)' }} />
                        </div>
                      ) : (
                        <div key={im.id} className="space-y-0.5">
                          {im.heading && <div className="text-gray-400" style={{ fontSize: 10 }}>{im.heading}</div>}
                          <img src={im.src} alt={im.heading || 'reference image'} title="Click to enlarge"
                            onClick={() => setLightboxSrc(im.src)}
                            style={{ display: 'block', maxWidth: '100%', maxHeight: 160, margin: '0 auto', borderRadius: 3, cursor: 'zoom-in', background: 'rgba(0,0,0,0.04)' }} />
                        </div>
                      )
                    ))}
                  </Section>
                )}

                {/* Links — clickable reference URLs (panel-only). */}
                {(localLinks.length > 0 || boxEdit) && (
                  <Section title="Links">
                    {localLinks.map(l => (
                      boxEdit ? (
                        <div key={l.id}
                          onDragOver={e => e.preventDefault()} onDrop={() => reorderDrop('link', l.id)}
                          className="space-y-1 rounded p-1.5" style={{ border: '1px solid var(--panel-border)', opacity: dragRowId === l.id ? 0.5 : 1 }}>
                          <div className="flex items-center gap-1">
                            <span draggable onDragStart={() => setDragRowId(l.id)} onDragEnd={() => setDragRowId(null)}
                              title="Drag to reorder" style={{ cursor: 'grab', fontSize: 12, color: 'var(--panel-border)', userSelect: 'none' }}>⠿</span>
                            <input className={INPUT_CLASS} style={{ ...INPUT_STYLE, flex: 1 }}
                              placeholder="Label (e.g. Datasheet)" defaultValue={l.label}
                              onBlur={e => commitLinks(updateLink(localLinks, l.id, { label: e.target.value }))} />
                            <RemoveButton title="Remove this link"
                              onClick={() => commitLinks(removeLink(localLinks, l.id))} />
                          </div>
                          <input className={INPUT_CLASS} style={INPUT_STYLE}
                            placeholder="https://…" defaultValue={l.url}
                            onBlur={e => commitLinks(updateLink(localLinks, l.id, { url: e.target.value }))} />
                        </div>
                      ) : (
                        <a key={l.id} href={normalizeUrl(l.url)} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ color: '#2563eb', fontSize: 11, display: 'block', wordBreak: 'break-all', textDecoration: 'underline' }}>
                          {l.label || l.url}
                        </a>
                      )
                    ))}
                  </Section>
                )}

                {/* Details / description — free-form notes. */}
                {(localBoxInfo.trim() || boxEdit) && (
                  <Section title="Description">
                    {boxEdit ? (
                      <textarea
                        className="w-full rounded px-1 py-0.5 outline-none resize-y"
                        style={{ fontSize: 11, minHeight: 48, maxHeight: 140, background: 'var(--input-bg, rgba(0,0,0,0.06))', border: '1px solid var(--panel-border)', color: 'var(--component-color)', display: 'block' }}
                        placeholder="Notes, datasheet info, etc."
                        value={localBoxInfo}
                        onChange={e => setLocalBoxInfo(e.target.value)}
                        onBlur={() => commitBox({ info: localBoxInfo })}
                      />
                    ) : (
                      <div style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{localBoxInfo}</div>
                    )}
                  </Section>
                )}

                {/* General add — adds to the right section and flips to edit mode. */}
                <div className="pt-2 mt-2 border-t flex flex-wrap gap-1" style={{ borderColor: 'var(--panel-border)' }}>
                  <MiniButton title="Add a property"
                    onClick={() => { const next = addField(localFields, {}); setLocalFields(next); commitBox({ fields: next }); setBoxEdit(true) }}>+ Property</MiniButton>
                  <MiniButton title="Add an image"
                    onClick={() => { setBoxEdit(true); boxImageInputRef.current?.click() }}>+ Image</MiniButton>
                  <MiniButton title="Paste an image from the clipboard"
                    onClick={() => { setBoxEdit(true); pasteImageFromClipboard() }}>Paste image</MiniButton>
                  <MiniButton title="Add a link"
                    onClick={() => { commitLinks(addLink(localLinks, {})); setBoxEdit(true) }}>+ Link</MiniButton>
                  <MiniButton title="Add a description"
                    onClick={() => setBoxEdit(true)}>+ Description</MiniButton>
                </div>
              </div>
            )}

            {/* Sim params */}
            {hasSimParams && (
              <div
                className="grid gap-1.5 pt-1 border-t"
                style={{
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  borderColor: 'var(--panel-border)',
                }}
              >
                {Object.entries(simParamDefs).map(([key, paramDef]) => {
                  if (paramDef.type === 'select') {
                    return (
                      <SelectField
                        key={key}
                        label={paramDef.label}
                        value={localSim[key] ?? paramDef.default ?? ''}
                        options={paramDef.options}
                        onChange={v => {
                          setLocalSim(s => ({ ...s, [key]: v }))
                          commitSimParam(key, v)
                        }}
                      />
                    )
                  }
                  return (
                    <Field
                      key={key}
                      label={paramDef.label}
                      type={paramDef.primary ? 'text' : 'number'}
                      value={localSim[key] ?? (paramDef.primary ? formatSI(paramDef.default, paramDef.unit ?? '') : (paramDef.default ?? ''))}
                      onChange={v => setLocalSim(s => ({ ...s, [key]: v }))}
                      onBlur={() => commitSimParam(key, localSim[key])}
                    />
                  )
                })}

                {/* Phase 12: linked solenoid designator for solenoid-actuated DCVs */}
                {localSim.actuation === 'solenoid' && (
                  <Field
                    label="Linked Solenoid"
                    value={localSim.linkedDesignator ?? ''}
                    onChange={v => setLocalSim(s => ({ ...s, linkedDesignator: v }))}
                    onBlur={() => commitSimParam('linkedDesignator', localSim.linkedDesignator ?? '')}
                    placeholder="e.g. YV1"
                  />
                )}
              </div>
            )}

            {isRunning && simCompState && (
              <div
                className="pt-1 border-t"
                style={{ borderColor: 'var(--panel-border)' }}
              >
                <div className="text-gray-400 mb-0.5" style={{ fontSize: 10 }}>Simulation</div>
                <div className="flex gap-3 flex-wrap" style={{ fontSize: 11 }}>
                  {simCompState.V != null && (
                    <span><span className="text-gray-400">V: </span>{fmtVal(simCompState.V, 'V')}</span>
                  )}
                  {simCompState.I != null && (
                    <span><span className="text-gray-400">I: </span>{fmtVal(simCompState.I, 'A')}</span>
                  )}
                  {simCompState.P != null && (
                    <span><span className="text-gray-400">P: </span>{fmtVal(simCompState.P, 'W')}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
