import React, { useState, useEffect, useCallback, useRef } from 'react'
import useSchematicStore from '../store/schematicStore'
import useSimulationStore from '../store/simulationStore'
import { getElectricalDef } from '../lib/components/electrical'
import { getHydraulicDef } from '../lib/components/hydraulic'
import { parseValue, formatSI } from '../lib/simulation/parseValue'
import { plainToDoc, applyDocStyle, setDocAlign, docToPlain, docToHtml, isEmptyDoc, emptyDoc } from '../lib/richText'
import { addBlock, updateBlock, removeBlock, moveBlock, migrateBlocks, HEADING_SIZES } from '../lib/boxBlocks'
import { normalizeUrl } from '../lib/boxLinks'
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

// Render free text with bare URLs turned into clickable links (used by the
// document view's text blocks — links are no longer a separate section).
function renderRichText(text) {
  const parts = String(text || '').split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g)
  return parts.map((p, i) => {
    if (/^(https?:\/\/|www\.)/.test(p)) {
      return (
        <a key={i} href={normalizeUrl(p)} target="_blank" rel="noreferrer"
          onClick={e => e.stopPropagation()}
          style={{ color: '#2563eb', textDecoration: 'underline', wordBreak: 'break-all' }}>{p}</a>
      )
    }
    return <span key={i}>{p}</span>
  })
}

// Shared "document content" renderer for a box or a junction. `blocks` is the
// ordered, mixed list (headings/properties/text/images). `commit(next)` persists
// a changed list. In view mode it reads like a formatted info document; in edit
// mode each block becomes inputs with a drag handle + remove button, reorderable
// across types via moveBlock.
function ContentBlocks({ blocks, editing, commit, onImageClick }) {
  const list = blocks || []
  // Reorder via explicit up/down buttons — reliable in the Tauri (WebKit) webview,
  // where HTML5 drag-and-drop is unreliable.
  const moveUp = (i) => { if (i > 0) commit(moveBlock(list, list[i].id, list[i - 1].id)) }
  const moveDown = (i) => { if (i < list.length - 1) commit(moveBlock(list, list[i].id, list[i + 1].id)) }

  if (!editing) {
    if (list.length === 0) {
      return <div className="text-gray-400" style={{ fontSize: 11 }}>Nothing yet — click Edit to add headings, properties, text or images.</div>
    }
    return (
      <div className="space-y-2">
        {list.map(b => {
          if (b.type === 'heading') {
            return <div key={b.id} style={{ fontSize: HEADING_SIZES[b.size] ?? HEADING_SIZES.medium, fontWeight: 700, lineHeight: 1.2 }}>{b.text || '—'}</div>
          }
          if (b.type === 'property') {
            return (
              <div key={b.id} className="flex justify-between gap-2" style={{ fontSize: 12 }}>
                <span className="text-gray-400 flex-shrink-0">{b.label || '—'}</span>
                <span className="text-right" style={{ wordBreak: 'break-word' }}>{b.value}{b.unit ? ` ${b.unit}` : ''}</span>
              </div>
            )
          }
          if (b.type === 'image') {
            return (
              <div key={b.id} className="space-y-1">
                {b.heading && <div style={{ fontSize: HEADING_SIZES[b.size] ?? HEADING_SIZES.medium, fontWeight: 700, lineHeight: 1.2 }}>{b.heading}</div>}
                <img src={b.src} alt={b.heading || 'reference image'} title="Click to enlarge"
                  onClick={() => onImageClick?.(b.src)}
                  style={{ display: 'block', maxWidth: '100%', maxHeight: 180, margin: '0 auto', borderRadius: 3, cursor: 'zoom-in', background: 'rgba(0,0,0,0.04)' }} />
              </div>
            )
          }
          // text
          return <div key={b.id} style={{ fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderRichText(b.text)}</div>
        })}
      </div>
    )
  }

  // Edit mode — one card per block; ▲/▼ reorder across types, × removes.
  const moveBtn = {
    width: 20, height: 18, lineHeight: 1, fontSize: 11, borderRadius: 3,
    border: '1px solid var(--panel-border)', color: 'var(--component-color)',
    background: 'var(--input-bg, rgba(0,0,0,0.06))', cursor: 'pointer',
  }
  return (
    <div className="space-y-1.5">
      {list.map((b, i) => (
        <div key={b.id}
          className="rounded p-1.5 space-y-1" style={{ border: '1px solid var(--panel-border)' }}>
          <div className="flex items-center gap-1">
            <button type="button" title="Move up" disabled={i === 0} style={{ ...moveBtn, opacity: i === 0 ? 0.35 : 1 }} onClick={() => moveUp(i)}>▲</button>
            <button type="button" title="Move down" disabled={i === list.length - 1} style={{ ...moveBtn, opacity: i === list.length - 1 ? 0.35 : 1 }} onClick={() => moveDown(i)}>▼</button>
            <span className="text-gray-400 uppercase flex-1" style={{ fontSize: 9, letterSpacing: '0.06em' }}>{b.type}</span>
            {(b.type === 'heading' || b.type === 'image') && (
              <select value={b.size || 'medium'} className="rounded px-1 outline-none"
                title="Heading size"
                style={{ fontSize: 10, height: 20, background: 'var(--input-bg, rgba(0,0,0,0.06))', border: '1px solid var(--panel-border)', color: 'var(--component-color)' }}
                onChange={e => commit(updateBlock(list, b.id, { size: e.target.value }))}>
                {Object.keys(HEADING_SIZES).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <RemoveButton title="Remove this block" onClick={() => commit(removeBlock(list, b.id))} />
          </div>
          {b.type === 'heading' && (
            <input className={INPUT_CLASS} style={{ ...INPUT_STYLE, fontWeight: 700 }} placeholder="Subheading"
              defaultValue={b.text} onBlur={e => commit(updateBlock(list, b.id, { text: e.target.value }))} />
          )}
          {b.type === 'property' && (
            <>
              <input className={INPUT_CLASS} style={INPUT_STYLE} placeholder="Property name"
                defaultValue={b.label} onBlur={e => commit(updateBlock(list, b.id, { label: e.target.value }))} />
              <div className="grid gap-1" style={{ gridTemplateColumns: '2fr 1fr' }}>
                <input className={INPUT_CLASS} style={INPUT_STYLE} placeholder="Value"
                  defaultValue={b.value} onBlur={e => commit(updateBlock(list, b.id, { value: e.target.value }))} />
                <input className={INPUT_CLASS} style={INPUT_STYLE} placeholder="Unit"
                  defaultValue={b.unit} onBlur={e => commit(updateBlock(list, b.id, { unit: e.target.value }))} />
              </div>
            </>
          )}
          {b.type === 'text' && (
            <textarea className="w-full rounded px-1 py-0.5 outline-none resize-y"
              style={{ fontSize: 11, minHeight: 44, maxHeight: 160, background: 'var(--input-bg, rgba(0,0,0,0.06))', border: '1px solid var(--panel-border)', color: 'var(--component-color)', display: 'block' }}
              placeholder="Notes, datasheet info, a link…" defaultValue={b.text}
              onBlur={e => commit(updateBlock(list, b.id, { text: e.target.value }))} />
          )}
          {b.type === 'image' && (
            <>
              <input className={INPUT_CLASS} style={INPUT_STYLE} placeholder="Caption (e.g. Pinout)"
                defaultValue={b.heading} onBlur={e => commit(updateBlock(list, b.id, { heading: e.target.value }))} />
              <img src={b.src} alt={b.heading || 'reference image'} title="Click to enlarge"
                onClick={() => onImageClick?.(b.src)}
                style={{ display: 'block', maxWidth: '100%', maxHeight: 160, margin: '0 auto', borderRadius: 3, cursor: 'zoom-in', background: 'rgba(0,0,0,0.04)' }} />
            </>
          )}
        </div>
      ))}
    </div>
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
  const updateJunction = useSchematicStore(s => s.updateJunction)
  const deleteIds = useSchematicStore(s => s.deleteIds)

  const isRunning = useSimulationStore(s => s.isRunning)
  const simCompState = useSimulationStore(s => s.componentStates[selectedIds[0]])
  const simWireState = useSimulationStore(s => s.wireStates[selectedIds[0]])

  const [local, setLocal] = useState({ designator: '', value: '', description: '', labelScale: 1, resistorStyle: '' })
  // The id the local edit buffers belong to, captured when the selection synced.
  // All blur-commits target THIS id (not the live selection) so a half-typed edit
  // can never land on the next item you click (item 5 — "edits leak across items").
  const [localOwnerId, setLocalOwnerId] = useState(null)
  // v0.4.0: a box's documentation is one ordered, mixed block list.
  const [localBlocks, setLocalBlocks] = useState([])
  const [localSim, setLocalSim] = useState({})
  const [localAnnText, setLocalAnnText] = useState('')
  const [localAnnSize, setLocalAnnSize] = useState(14)
  const [localImg, setLocalImg] = useState({ x: 0, y: 0, width: 0, height: 0, opacity: 1, rotation: 0 })
  const [localBox, setLocalBox] = useState({ width: 80, height: 60, cornerRadius: 4, fill: '#f1f5f9', stroke: '#334155', title: '', W: 1, E: 1, N: 0, S: 0 })
  const [localBoxLabelSize, setLocalBoxLabelSize] = useState(11)
  // Junction documentation (shares the block model with boxes).
  const [localJunction, setLocalJunction] = useState({ label: '' })
  const [localJunctionBlocks, setLocalJunctionBlocks] = useState([])
  const [localWire, setLocalWire] = useState({ color: '', style: 'solid', weight: 1 })
  const [localTable, setLocalTable] = useState({ borderColor: '#334155', borderWidth: 1, headerRow: false, fill: '' })
  // Box content view/edit toggle (clean read-only view by default; flip to Edit
  // for textboxes + delete + drag-reorder). Resets to view on selection change.
  const [boxEdit, setBoxEdit] = useState(false)
  // Configure disclosure (geometry/colour/pin/label-style) — collapsed by default
  // so the pane reads like a clean info document (item 10).
  const [configOpen, setConfigOpen] = useState(false)
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
        || (drawing?.tables || []).find(t => t.id === selectedIds[0])
        || (drawing?.junctions || []).find(j => j.id === selectedIds[0]))
      : 'multi'

  // Junctions live in drawing.junctions — identify by membership so the
  // shape-based checks below don't mistake a junction (no designator/src) for an
  // image or component.
  const isJunction = selected && selected !== 'multi' && (drawing?.junctions || []).some(j => j.id === selected.id)
  // Tables carry a `cells` 2-D array; distinguish them before images/wires.
  const isTable = selected && selected !== 'multi' && !isJunction && Array.isArray(selected.cells)
  // Images carry a `src` (and no designator/text), so distinguish them first.
  const isImage = selected && selected !== 'multi' && !isJunction && !isTable && selected.src !== undefined && selected.designator === undefined
  const isAnnotation = selected && selected !== 'multi' && !isJunction && !isImage && !isTable && (selected.type === 'text' || selected.type === 'callout')
  const isComponent = selected && selected !== 'multi' && !isJunction && !isAnnotation && !isImage && !isTable && selected.designator !== undefined
  const isBox = isComponent && selected.type === 'box'
  const isWire = selected && selected !== 'multi' && !isJunction && !isComponent && !isAnnotation && !isImage && !isTable && Array.isArray(selected.points)

  // Sync local state when selection changes
  useEffect(() => {
    setLocalOwnerId(selectedIds[0] ?? null)
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
        title: b.title ?? '',
        ...counts,
      })
      setLocalBlocks(migrateBlocks(b))
      const firstRun = (b.doc?.paragraphs || []).flatMap(p => p.runs || []).find(r => r.text)
      setLocalBoxLabelSize(firstRun?.fontSize ?? 11)
    }
    if (isJunction) {
      setLocalJunction({ label: selected.label ?? '' })
      setLocalJunctionBlocks(migrateBlocks(selected))
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
    setConfigOpen(false)
  }, [selectedIds[0]])

  // Look up the entity the local edit buffers belong to, fresh from the store, by
  // the captured owner id (NOT the live selection). Used by blur-commits so an
  // edit always lands on the item that was being edited.
  const getOwnerComponent = useCallback(() => {
    if (!localOwnerId) return null
    const dr = useSchematicStore.getState().drawings.find(d => d.id === activeDrawingId)
    return (dr?.components || []).find(c => c.id === localOwnerId) || null
  }, [activeDrawingId, localOwnerId])

  const commitField = useCallback((field, val) => {
    if (!getOwnerComponent()) return
    pushUndo()
    updateComponent(activeDrawingId, localOwnerId, { [field]: val })
  }, [activeDrawingId, localOwnerId, getOwnerComponent, pushUndo, updateComponent])

  const commitSimParam = useCallback((key, val) => {
    const owner = getOwnerComponent()
    if (!owner) return
    const def = getAnyDef(owner.type)
    const paramDef = def?.simParams?.[key]
    let stored = val
    if (paramDef?.primary) {
      const num = parseValue(String(val), paramDef.default)
      stored = num
      setLocalSim(s => ({ ...s, [key]: formatSI(num, paramDef.unit ?? '') }))
    }
    pushUndo()
    updateComponentSimParam(activeDrawingId, localOwnerId, key, stored)
  }, [activeDrawingId, localOwnerId, getOwnerComponent, pushUndo, updateComponentSimParam])

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
    if (!localOwnerId) return
    pushUndo()
    updateAnnotation(activeDrawingId, localOwnerId, { doc })
  }, [isAnnotation, activeDrawingId, localOwnerId, annDoc, pushUndo])

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
    if (!localOwnerId) return
    pushUndo()
    updateImage(activeDrawingId, localOwnerId, patch)
  }, [activeDrawingId, localOwnerId, pushUndo, updateImage])

  // Box style/geometry commit (grid-snapping + pin re-derivation handled by the
  // store's updateBox). Targets the captured owner id and verifies it is a box, so
  // a blur after switching selection can't write to the wrong box (item 5).
  const commitBox = useCallback((boxPatch, pinSpec = null) => {
    if (!localOwnerId) return
    const owner = getOwnerComponent()
    if (!owner || owner.type !== 'box') return
    pushUndo()
    updateBox(activeDrawingId, localOwnerId, boxPatch, pinSpec)
  }, [activeDrawingId, localOwnerId, getOwnerComponent, pushUndo, updateBox])

  const commitBoxPins = useCallback((counts) => {
    const owner = getOwnerComponent()
    if (!owner || owner.type !== 'box') return
    const spec = { W: counts.W, E: counts.E, N: counts.N, S: counts.S }
    pushUndo()
    updateBox(activeDrawingId, localOwnerId, {}, spec)
  }, [activeDrawingId, localOwnerId, getOwnerComponent, pushUndo, updateBox])

  const replaceInputRef = useRef(null)
  const onReplaceImage = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !isImage) return
    const reader = new FileReader()
    reader.onload = () => commitImageField({ src: reader.result })
    reader.readAsDataURL(file)
  }

  // ── Unified documentation blocks (v0.4.0) — works for the selected box OR
  // junction. `docBlocks` is the live list; `commitBlocks` persists a changed list
  // to the right owner (box.blocks via updateBox / junction.blocks via updateJunction).
  const docBlocks = isBox ? localBlocks : isJunction ? localJunctionBlocks : []
  const commitBlocks = useCallback((next) => {
    if (!localOwnerId) return
    const dr = useSchematicStore.getState().drawings.find(d => d.id === activeDrawingId)
    const comp = (dr?.components || []).find(c => c.id === localOwnerId)
    if (comp?.type === 'box') {
      setLocalBlocks(next)
      pushUndo()
      updateBox(activeDrawingId, localOwnerId, { blocks: next })
      return
    }
    const jct = (dr?.junctions || []).find(j => j.id === localOwnerId)
    if (jct) {
      setLocalJunctionBlocks(next)
      pushUndo()
      updateJunction(activeDrawingId, localOwnerId, { blocks: next })
    }
  }, [activeDrawingId, localOwnerId, pushUndo, updateBox, updateJunction])

  // Add image block(s) from chosen files (panel-only documentation pictures).
  const boxImageInputRef = useRef(null)
  const onAssignBoxImage = (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length || (!isBox && !isJunction)) return
    Promise.all(files.map(file => new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    }))).then(srcs => {
      let next = docBlocks
      for (const src of srcs) if (src) next = addBlock(next, { type: 'image', src })
      commitBlocks(next)
      setBoxEdit(true)
    })
  }

  // Commit a single box pin's label without rebuilding the pin layout.
  const commitPinLabel = useCallback((pinId, label) => {
    const owner = getOwnerComponent()
    if (!owner || owner.type !== 'box') return
    const pins = (owner.pins || []).map(p => p.id === pinId ? { ...p, label } : p)
    pushUndo()
    updateComponent(activeDrawingId, localOwnerId, { pins })
  }, [activeDrawingId, localOwnerId, getOwnerComponent, pushUndo, updateComponent])

  // ── Box label whole-doc quick styles (fixes "font size not working on boxes":
  // the panel now sizes/styles the ENTIRE box label, not just an editor range).
  const boxDoc = isBox ? (selected.box?.doc || emptyDoc()) : null
  const boxDocHasAll = useCallback((attr) => {
    if (!boxDoc) return false
    const runs = boxDoc.paragraphs.flatMap(p => p.runs || []).filter(r => r.text)
    return runs.length > 0 && runs.every(r => r[attr])
  }, [boxDoc])
  const commitBoxDocStyle = useCallback((patch) => {
    if (!isBox) return
    commitBox({ doc: applyDocStyle(boxDoc, patch) })
  }, [isBox, boxDoc, commitBox])
  const commitBoxDocAlign = useCallback((align) => {
    if (!isBox) return
    commitBox({ doc: setDocAlign(boxDoc, align) })
  }, [isBox, boxDoc, commitBox])

  // ── Paste an image from the clipboard straight into the document as an image
  // block. Works for a box OR a junction. Only intercepts image items — text
  // paste into inputs is never swallowed (Windows-paste fix, Stage 6).
  const onBoxPaste = useCallback((e) => {
    if (!isBox && !isJunction) return
    const items = e.clipboardData?.items
    const files = e.clipboardData?.files
    const pickFile = () => {
      if (items) for (const it of items) if (it.type?.startsWith('image/')) return it.getAsFile()
      if (files) for (const f of files) if (f.type?.startsWith('image/')) return f
      return null
    }
    const file = pickFile()
    if (!file) return
    e.preventDefault()
    e.stopPropagation()
    const reader = new FileReader()
    reader.onload = () => { commitBlocks(addBlock(docBlocks, { type: 'image', src: reader.result })); setBoxEdit(true) }
    reader.readAsDataURL(file)
  }, [isBox, isJunction, docBlocks, commitBlocks])

  // Explicit "Paste image" button — async clipboard read with a graceful no-op
  // when the webview denies it (common on Windows/Tauri).
  const pasteImageFromClipboard = useCallback(async () => {
    if ((!isBox && !isJunction) || !navigator.clipboard?.read) return
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find(t => t.startsWith('image/'))
        if (!type) continue
        const blob = await item.getType(type)
        const reader = new FileReader()
        reader.onload = () => { commitBlocks(addBlock(docBlocks, { type: 'image', src: reader.result })); setBoxEdit(true) }
        reader.readAsDataURL(blob)
        return
      }
    } catch { /* clipboard unreadable / denied — ignore */ }
  }, [isBox, isJunction, docBlocks, commitBlocks])

  // ── Wire styling. Targets the captured owner id (item 5 safety).
  const commitWire = useCallback((patch) => {
    if (!localOwnerId) return
    pushUndo()
    updateWire(activeDrawingId, localOwnerId, patch)
  }, [activeDrawingId, localOwnerId, pushUndo, updateWire])

  // ── Table structure + styling. Structural ops go through tableModel helpers
  // (which keep cells/colWidths/rowHeights rectangular) then patch the whole table.
  const commitTable = useCallback((patch) => {
    if (!localOwnerId) return
    pushUndo()
    updateTable(activeDrawingId, localOwnerId, patch)
  }, [activeDrawingId, localOwnerId, pushUndo, updateTable])
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

        {/* Junction selected (v0.4.0) — a documentable connection node. Same
            clean document model as boxes (name + mixed reorderable blocks). */}
        {isJunction && (
          <div className="space-y-1.5" onPaste={onBoxPaste}>
            <input ref={boxImageInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onAssignBoxImage} />
            <div style={{ fontSize: 13, fontWeight: 700 }}>Junction</div>
            <Field label="Name" value={localJunction.label}
              onChange={v => setLocalJunction({ label: v })}
              onBlur={() => { pushUndo(); updateJunction(activeDrawingId, selected.id, { label: localJunction.label }) }}
              placeholder="e.g. Node A" />

            <div className="pt-2 mt-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--panel-border)' }}>
              <span className="text-gray-400 font-semibold uppercase" style={{ fontSize: 11, letterSpacing: '0.04em' }}>Documentation</span>
              <MiniButton title={boxEdit ? 'Finish editing' : 'Edit content'}
                onClick={() => setBoxEdit(e => !e)}>{boxEdit ? 'Done' : 'Edit'}</MiniButton>
            </div>
            <div className="mt-1.5">
              <ContentBlocks blocks={localJunctionBlocks} editing={boxEdit} commit={commitBlocks}
                onImageClick={setLightboxSrc} dragRowId={dragRowId} setDragRowId={setDragRowId} />
            </div>

            <div className="pt-2 mt-2 border-t flex flex-wrap gap-1" style={{ borderColor: 'var(--panel-border)' }}>
              <MiniButton title="Add a subheading"
                onClick={() => { commitBlocks(addBlock(docBlocks, { type: 'heading' })); setBoxEdit(true) }}>+ Heading</MiniButton>
              <MiniButton title="Add a property row"
                onClick={() => { commitBlocks(addBlock(docBlocks, { type: 'property' })); setBoxEdit(true) }}>+ Property</MiniButton>
              <MiniButton title="Add a text paragraph"
                onClick={() => { commitBlocks(addBlock(docBlocks, { type: 'text' })); setBoxEdit(true) }}>+ Text</MiniButton>
              <MiniButton title="Add an image"
                onClick={() => { setBoxEdit(true); boxImageInputRef.current?.click() }}>+ Image</MiniButton>
              <MiniButton title="Paste an image from the clipboard"
                onClick={() => { setBoxEdit(true); pasteImageFromClipboard() }}>Paste image</MiniButton>
            </div>

            <button
              className="rounded px-2 py-0.5 text-red-500 mt-1"
              style={{ fontSize: 11, border: '1px solid var(--panel-border)' }}
              onClick={() => deleteIds(activeDrawingId, [selected.id])}
            >Delete junction</button>
          </div>
        )}

        {/* Component selected */}
        {isComponent && (
          <div className="space-y-1.5">
            {/* Non-box components keep the compact Ref / Value / Desc fields.
                Boxes use the document layout below (big Ref title + description). */}
            {!isBox && (<>
            {/* Basic fields row */}
            <div className="grid gap-1.5" style={{ gridTemplateColumns: hasPrimaryParam ? '1fr 1.5fr' : '1fr 1fr 1.5fr' }}>
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
                label="Ref label size"
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
            </>)}

            {/* Box editor (v0.4.0): a clean info document — big Ref title, a
                Description box, then mixed reorderable blocks. Editing is gated by
                the Edit button; geometry/colour/pins/ref-size live under Configure. */}
            {isBox && (
              <div onPaste={onBoxPaste}>
                <input ref={boxImageInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onAssignBoxImage} />

                {/* Header: the document Edit toggle. */}
                <div className="flex items-center justify-end">
                  <MiniButton title={boxEdit ? 'Finish editing' : 'Edit this component'}
                    onClick={() => setBoxEdit(e => !e)}>{boxEdit ? 'Done' : 'Edit'}</MiniButton>
                </div>

                {/* Title — a properties-only name for the component (NOT the ref,
                    NOT drawn on the canvas), shown big at the top. */}
                {boxEdit ? (
                  <input
                    className="w-full rounded px-1 outline-none"
                    style={{ fontSize: 20, fontWeight: 800, height: 30, background: 'var(--input-bg, rgba(0,0,0,0.06))', border: '1px solid var(--panel-border)', color: 'var(--component-color)' }}
                    value={localBox.title}
                    placeholder="Title"
                    onChange={e => setLocalBox(b => ({ ...b, title: e.target.value }))}
                    onBlur={() => commitBox({ title: localBox.title })}
                  />
                ) : (
                  <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15, wordBreak: 'break-word' }}>
                    {localBox.title || <span className="text-gray-400">Untitled</span>}
                  </div>
                )}

                {/* Ref / label — just under the title, smaller + italic. */}
                {boxEdit ? (
                  <input
                    className="w-full rounded px-1 outline-none mt-0.5"
                    style={{ fontSize: 12, fontStyle: 'italic', height: 20, background: 'var(--input-bg, rgba(0,0,0,0.06))', border: '1px solid var(--panel-border)', color: 'var(--component-color)' }}
                    value={local.designator}
                    placeholder="Ref (e.g. BX1)"
                    onChange={e => setLocal(l => ({ ...l, designator: e.target.value }))}
                    onBlur={() => commitField('designator', local.designator)}
                  />
                ) : (
                  local.designator
                    ? <div className="text-gray-400 mt-0.5" style={{ fontSize: 12, fontStyle: 'italic', wordBreak: 'break-word' }}>{local.designator}</div>
                    : null
                )}

                {/* Description — always present, just under the title. */}
                {boxEdit ? (
                  <textarea
                    className="w-full rounded px-1 py-0.5 outline-none resize-y mt-1"
                    style={{ fontSize: 12, minHeight: 48, maxHeight: 160, background: 'var(--input-bg, rgba(0,0,0,0.06))', border: '1px solid var(--panel-border)', color: 'var(--component-color)', display: 'block' }}
                    placeholder="Description…"
                    value={local.description}
                    onChange={e => setLocal(l => ({ ...l, description: e.target.value }))}
                    onBlur={() => commitField('description', local.description)}
                  />
                ) : (
                  local.description
                    ? <div className="mt-1" style={{ fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderRichText(local.description)}</div>
                    : <div className="mt-1 text-gray-400" style={{ fontSize: 11 }}>No description</div>
                )}

                {/* Documentation blocks — anything else, below the description. */}
                <div className="mt-2">
                  <ContentBlocks blocks={localBlocks} editing={boxEdit} commit={commitBlocks}
                    onImageClick={setLightboxSrc} />
                </div>

                {/* Add a block of any type — only while editing. */}
                {boxEdit && (
                  <div className="pt-2 mt-2 border-t flex flex-wrap gap-1" style={{ borderColor: 'var(--panel-border)' }}>
                    <MiniButton title="Add a subheading"
                      onClick={() => commitBlocks(addBlock(localBlocks, { type: 'heading' }))}>+ Heading</MiniButton>
                    <MiniButton title="Add a property row"
                      onClick={() => commitBlocks(addBlock(localBlocks, { type: 'property' }))}>+ Property</MiniButton>
                    <MiniButton title="Add a text paragraph"
                      onClick={() => commitBlocks(addBlock(localBlocks, { type: 'text' }))}>+ Text</MiniButton>
                    <MiniButton title="Add an image"
                      onClick={() => boxImageInputRef.current?.click()}>+ Image</MiniButton>
                    <MiniButton title="Paste an image from the clipboard"
                      onClick={() => pasteImageFromClipboard()}>Paste image</MiniButton>
                  </div>
                )}

                {/* Configure — geometry/colour/pins/label-style/ref-size, collapsed. */}
                <div className="pt-2 mt-2 border-t" style={{ borderColor: 'var(--panel-border)' }}>
                  <button type="button"
                    className="flex items-center gap-1 text-gray-400 font-semibold uppercase w-full"
                    style={{ fontSize: 10, letterSpacing: '0.04em' }}
                    onClick={() => setConfigOpen(o => !o)}>
                    <span style={{ width: 10 }}>{configOpen ? '▾' : '▸'}</span>
                    <span>⚙ Configure</span>
                  </button>
                  {configOpen && (
                   <div className="mt-1">
                {/* Ref label size — how big the designator renders on the canvas. */}
                <Section title="Canvas label">
                  <Field label="Ref label size" type="number" value={local.labelScale}
                    onChange={v => setLocal(l => ({ ...l, labelScale: v }))}
                    onBlur={() => { const n = Number(local.labelScale); if (n > 0) commitField('labelScale', n) }} />
                </Section>
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
                   </div>
                  )}
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
                  if (paramDef.type === 'textarea') {
                    return (
                      <div key={key} className="mb-1">
                        <div className="text-gray-400 mb-0.5" style={{ fontSize: 10 }}>{paramDef.label}</div>
                        <textarea
                          className="w-full px-1 py-0.5 rounded border bg-transparent"
                          style={{ borderColor: 'var(--panel-border)', fontSize: 11, minHeight: 44, resize: 'vertical' }}
                          value={localSim[key] ?? paramDef.default ?? ''}
                          onChange={e => setLocalSim(s => ({ ...s, [key]: e.target.value }))}
                          onBlur={() => commitSimParam(key, localSim[key] ?? '')}
                        />
                      </div>
                    )
                  }
                  if (paramDef.type === 'text') {
                    return (
                      <Field
                        key={key}
                        label={paramDef.label}
                        type="text"
                        value={localSim[key] ?? paramDef.default ?? ''}
                        onChange={v => setLocalSim(s => ({ ...s, [key]: v }))}
                        onBlur={() => commitSimParam(key, localSim[key] ?? '')}
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
