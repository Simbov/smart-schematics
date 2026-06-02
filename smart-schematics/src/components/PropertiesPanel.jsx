import React, { useState, useEffect, useCallback, useRef } from 'react'
import useSchematicStore from '../store/schematicStore'
import useSimulationStore from '../store/simulationStore'
import { getElectricalDef } from '../lib/components/electrical'
import { getHydraulicDef } from '../lib/components/hydraulic'
import { parseValue, formatSI } from '../lib/simulation/parseValue'

function getAnyDef(type) { return getElectricalDef(type) || getHydraulicDef(type) }

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
  const updateImage = useSchematicStore(s => s.updateImage)
  const removeImage = useSchematicStore(s => s.removeImage)

  const isRunning = useSimulationStore(s => s.isRunning)
  const simCompState = useSimulationStore(s => s.componentStates[selectedIds[0]])
  const simWireState = useSimulationStore(s => s.wireStates[selectedIds[0]])

  const [local, setLocal] = useState({ designator: '', value: '', description: '' })
  const [localSim, setLocalSim] = useState({})
  const [localAnn, setLocalAnn] = useState({ text: '', fontSize: 14, fontWeight: 'normal', fontStyle: 'normal' })
  const [localImg, setLocalImg] = useState({ x: 0, y: 0, width: 0, height: 0, opacity: 1, rotation: 0 })

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
      setLocalAnn({
        text: selected.text ?? '',
        fontSize: selected.fontSize ?? 14,
        fontWeight: selected.fontWeight ?? 'normal',
        fontStyle: selected.fontStyle ?? 'normal',
      })
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

  const commitAnnotationField = useCallback((field, val) => {
    if (!isAnnotation) return
    updateAnnotation(activeDrawingId, selected.id, { [field]: val })
  }, [isAnnotation, activeDrawingId, selected?.id])

  const commitImageField = useCallback((patch) => {
    if (!isImage) return
    pushUndo()
    updateImage(activeDrawingId, selected.id, patch)
  }, [isImage, activeDrawingId, selected?.id])

  const replaceInputRef = useRef(null)
  const onReplaceImage = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !isImage) return
    const reader = new FileReader()
    reader.onload = () => commitImageField({ src: reader.result })
    reader.readAsDataURL(file)
  }

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

        {/* Annotation selected */}
        {isAnnotation && (
          <div className="space-y-1.5">
            <div>
              <span className="text-gray-400 block mb-0.5" style={{ fontSize: 10 }}>
                {selected.type === 'callout' ? 'Callout text (double-click on canvas to edit)' : 'Text (double-click on canvas to edit)'}
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
                value={localAnn.text}
                onChange={e => setLocalAnn(a => ({ ...a, text: e.target.value }))}
                onBlur={() => commitAnnotationField('text', localAnn.text)}
              />
            </div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <Field
                label="Size"
                type="number"
                value={localAnn.fontSize}
                onChange={v => setLocalAnn(a => ({ ...a, fontSize: Number(v) }))}
                onBlur={() => commitAnnotationField('fontSize', localAnn.fontSize)}
              />
              {selected.type === 'text' && (
                <>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 flex-shrink-0" style={{ fontSize: 10 }}>Bold</span>
                    <input
                      type="checkbox"
                      checked={localAnn.fontWeight === 'bold'}
                      onChange={e => {
                        const v = e.target.checked ? 'bold' : 'normal'
                        setLocalAnn(a => ({ ...a, fontWeight: v }))
                        commitAnnotationField('fontWeight', v)
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 flex-shrink-0" style={{ fontSize: 10 }}>Italic</span>
                    <input
                      type="checkbox"
                      checked={localAnn.fontStyle === 'italic'}
                      onChange={e => {
                        const v = e.target.checked ? 'italic' : 'normal'
                        setLocalAnn(a => ({ ...a, fontStyle: v }))
                        commitAnnotationField('fontStyle', v)
                      }}
                    />
                  </div>
                </>
              )}
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
