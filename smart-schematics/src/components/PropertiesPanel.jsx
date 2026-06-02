import React, { useState, useEffect, useCallback } from 'react'
import useSchematicStore from '../store/schematicStore'
import useSimulationStore from '../store/simulationStore'
import { getElectricalDef } from '../lib/components/electrical'
import { getHydraulicDef } from '../lib/components/hydraulic'
import { parseValue, formatSI } from '../lib/simulation/parseValue'
import { plainToDoc, applyDocStyle, setDocAlign, docToPlain } from '../lib/richText'

function getAnyDef(type) { return getElectricalDef(type) || getHydraulicDef(type) }

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

export default function PropertiesPanel() {
  const selectedIds = useSchematicStore(s => s.selectedIds)
  const activeDrawingId = useSchematicStore(s => s.activeDrawingId)
  const drawing = useSchematicStore(s => s.drawings.find(d => d.id === s.activeDrawingId))
  const pushUndo = useSchematicStore(s => s.pushUndo)
  const updateComponent = useSchematicStore(s => s.updateComponent)
  const updateComponentSimParam = useSchematicStore(s => s.updateComponentSimParam)
  const updateAnnotation = useSchematicStore(s => s.updateAnnotation)

  const isRunning = useSimulationStore(s => s.isRunning)
  const simCompState = useSimulationStore(s => s.componentStates[selectedIds[0]])
  const simWireState = useSimulationStore(s => s.wireStates[selectedIds[0]])

  const [local, setLocal] = useState({ designator: '', value: '', description: '' })
  const [localSim, setLocalSim] = useState({})
  const [localAnnText, setLocalAnnText] = useState('')
  const [localAnnSize, setLocalAnnSize] = useState(14)

  const selected = selectedIds.length === 0 ? null
    : selectedIds.length === 1
      ? (drawing?.components.find(c => c.id === selectedIds[0])
        || drawing?.wires.find(w => w.id === selectedIds[0])
        || (drawing?.annotations || []).find(a => a.id === selectedIds[0]))
      : 'multi'

  const isAnnotation = selected && selected !== 'multi' && (selected.type === 'text' || selected.type === 'callout')
  const isComponent = selected && selected !== 'multi' && !isAnnotation && selected.designator !== undefined

  // Sync local state when selection changes
  useEffect(() => {
    if (isComponent) {
      setLocal({
        designator: selected.designator ?? '',
        value: selected.value ?? '',
        description: selected.description ?? '',
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

  const def = isComponent ? getAnyDef(selected.type) : null
  const simParamDefs = def?.simParams ?? {}
  const hasSimParams = Object.keys(simParamDefs).length > 0
  const hasPrimaryParam = Object.values(simParamDefs).some(p => p.primary)

  return (
    <div
      className="border-t flex-shrink-0"
      style={{
        background: 'var(--panel-bg)',
        borderColor: 'var(--panel-border)',
        overflowY: 'auto',
        maxHeight: 200,
        minHeight: 90,
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

        {/* Component selected */}
        {isComponent && (
          <div className="space-y-1.5">
            {/* Basic fields row */}
            <div className="grid gap-1.5" style={{ gridTemplateColumns: hasPrimaryParam ? '1fr 1.5fr' : '1fr 1fr 1.5fr' }}>
              <Field
                label="Ref"
                value={local.designator}
                onChange={v => setLocal(l => ({ ...l, designator: v }))}
                onBlur={() => commitField('designator', local.designator)}
                placeholder="R1"
              />
              {!hasPrimaryParam && (
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
