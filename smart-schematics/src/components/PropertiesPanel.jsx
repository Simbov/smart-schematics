import React, { useState, useEffect, useCallback, useRef } from 'react'
import useSchematicStore from '../store/schematicStore'
import useSimulationStore from '../store/simulationStore'
import { getElectricalDef } from '../lib/components/electrical'
import { getHydraulicDef } from '../lib/components/hydraulic'
import { parseValue, formatSI } from '../lib/simulation/parseValue'
import { plainToDoc, applyDocStyle, setDocAlign, docToPlain } from '../lib/richText'
import { addField, updateField, removeField } from '../lib/boxFields'
import { addBoxImage, updateBoxImage, removeBoxImage, normalizeBoxImages } from '../lib/boxImages'
import { RESISTOR_STYLES } from '../lib/resistorStyle'

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

  const selected = selectedIds.length === 0 ? null
    : selectedIds.length === 1
      ? (drawing?.components.find(c => c.id === selectedIds[0])
        || drawing?.wires.find(w => w.id === selectedIds[0])
        || (drawing?.annotations || []).find(a => a.id === selectedIds[0])
        || (drawing?.images || []).find(im => im.id === selectedIds[0]))
      : 'multi'

  // Images carry a `src` (and no designator/text), so distinguish them first.
  const isImage = selected && selected !== 'multi' && selected.src !== undefined && selected.designator === undefined
  const isAnnotation = selected && selected !== 'multi' && !isImage && (selected.type === 'text' || selected.type === 'callout')
  const isComponent = selected && selected !== 'multi' && !isAnnotation && !isImage && selected.designator !== undefined
  const isBox = isComponent && selected.type === 'box'

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
    }
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

  const def = isComponent ? getAnyDef(selected.type) : null
  const simParamDefs = def?.simParams ?? {}
  const hasSimParams = Object.keys(simParamDefs).length > 0
  const hasPrimaryParam = Object.values(simParamDefs).some(p => p.primary)

  return (
    <div
      className="border-l flex-shrink-0 flex flex-col"
      style={{
        background: 'var(--panel-bg)',
        borderColor: 'var(--panel-border)',
        overflowY: 'auto',
        overflowX: 'hidden',
        width: 280,
        height: '100%',
      }}
    >
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
        {selected && selected !== 'multi' && !isComponent && !isAnnotation && (
          <div style={{ fontSize: 11 }}>
            <span className="text-gray-400">Type: </span>Wire
            {selected.netLabel && (
              <span className="ml-3"><span className="text-gray-400">Net: </span>{selected.netLabel}</span>
            )}
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
              <>
                {/* Appearance — geometry + colours. */}
                <Section title="Appearance">
                  <div className="text-gray-400" style={{ fontSize: 10 }}>Double-click the box on the canvas to edit its label.</div>
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

                {/* Properties — flexible rows. Each is a self-contained card so the
                    remove button is always visible (no horizontal overflow). */}
                <Section
                  title="Properties"
                  action={<MiniButton title="Add a property"
                    onClick={() => { const next = addField(localFields, {}); setLocalFields(next); commitBox({ fields: next }) }}>+ Add</MiniButton>}
                >
                  {localFields.length === 0 && (
                    <div className="text-gray-400" style={{ fontSize: 10 }}>No properties yet. Use “+ Add”.</div>
                  )}
                  {localFields.map(f => (
                    <div key={f.id} className="rounded p-1.5 space-y-1" style={{ border: '1px solid var(--panel-border)' }}>
                      <div className="flex items-center gap-1">
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
                  ))}
                </Section>

                {/* Reference images — panel-only documentation (not drawn on the
                    canvas). Each picture sits under an editable heading. */}
                <Section
                  title="Images"
                  action={<MiniButton title="Add an image"
                    onClick={() => boxImageInputRef.current?.click()}>+ Add</MiniButton>}
                >
                  <input ref={boxImageInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onAssignBoxImage} />
                  {localBoxImages.length === 0 && (
                    <div className="text-gray-400" style={{ fontSize: 10 }}>No images. Pictures here are reference only — not shown on the schematic.</div>
                  )}
                  {localBoxImages.map(im => (
                    <div key={im.id} className="space-y-1 rounded p-1.5" style={{ border: '1px solid var(--panel-border)' }}>
                      <div className="flex items-center gap-1">
                        <input className={INPUT_CLASS} style={{ ...INPUT_STYLE, flex: 1 }}
                          placeholder="Heading (e.g. Pinout)" defaultValue={im.heading}
                          onBlur={e => commitBoxImages(updateBoxImage(localBoxImages, im.id, { heading: e.target.value }))} />
                        <RemoveButton title="Remove this image"
                          onClick={() => commitBoxImages(removeBoxImage(localBoxImages, im.id))} />
                      </div>
                      <img src={im.src} alt={im.heading || 'reference image'}
                        style={{ display: 'block', maxWidth: '100%', maxHeight: 160, margin: '0 auto', borderRadius: 3, background: 'rgba(0,0,0,0.04)' }} />
                    </div>
                  ))}
                </Section>

                {/* Details / info — free-form notes. */}
                <Section title="Details">
                  <textarea
                    className="w-full rounded px-1 py-0.5 outline-none resize-y"
                    style={{ fontSize: 11, minHeight: 48, maxHeight: 140, background: 'var(--input-bg, rgba(0,0,0,0.06))', border: '1px solid var(--panel-border)', color: 'var(--component-color)', display: 'block' }}
                    placeholder="Notes, datasheet info, etc."
                    value={localBoxInfo}
                    onChange={e => setLocalBoxInfo(e.target.value)}
                    onBlur={() => commitBox({ info: localBoxInfo })}
                  />
                </Section>
              </>
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
