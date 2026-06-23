import React, { useRef, useState } from 'react'
import { Cpu, Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, Download, Upload, ImagePlus, Pencil, Check, ArrowUpDown, FileText } from 'lucide-react'
import useSchematicStore from '../store/schematicStore'
import {
  addDevice, updateDevice, removeDevice,
  addPin, updatePin, removePin, movePin,
  addDeviceImage, removeDeviceImage,
  addDeviceDatasheet, removeDeviceDatasheet,
  devicesToCsv, deviceToCsv, deviceToJson, deviceFromJson, csvToDevices, appendImportedDevices,
  sortPins, pinIsCapable, kindOptionsForPin, groupPinsByConnector,
  PIN_KINDS, PIN_KIND_GROUPS, PIN_SORT_MODES,
} from '../lib/plcDevices'
import { isRunningInTauri, saveFileDialog, writeTextFile, writeBinaryFile, base64ToBytes } from '../lib/tauriFs'
import Lightbox from './Lightbox'

// A base64 data URL ("data:<mime>;base64,<payload>") split into its raw base64
// payload, so binary docs (PDFs, etc.) can be decoded to bytes for a real file.
function dataUrlToBytes(dataUrl) {
  const comma = String(dataUrl || '').indexOf(',')
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  return base64ToBytes(b64)
}

// Modal that previews a device document inline — PDFs in an iframe, images in an
// <img> — so datasheets can be read without downloading (issue #27).
function DocViewer({ doc, onClose }) {
  const isImage = (doc.mime || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(doc.name || '')
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.8)' }} onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-2 text-white" style={{ fontSize: 13 }} onClick={e => e.stopPropagation()}>
        <span className="truncate">{doc.name}</span>
        <button className="ml-3 rounded px-2 py-0.5" style={{ background: 'rgba(255,255,255,0.15)' }} onClick={onClose}>Close</button>
      </div>
      <div className="flex-1 m-2 mt-0 bg-white rounded overflow-hidden" onClick={e => e.stopPropagation()}>
        {isImage
          ? <img src={doc.data} alt={doc.name} className="w-full h-full" style={{ objectFit: 'contain' }} />
          : <iframe src={doc.data} title={doc.name} className="w-full h-full" style={{ border: 'none' }} />}
      </div>
    </div>
  )
}

const INPUT_CLASS = 'rounded px-1.5 outline-none bg-transparent border w-full'
const INPUT_STYLE = { fontSize: 12, height: 24, borderColor: 'var(--panel-border)', color: 'var(--component-color)' }
const TH_STYLE = { fontSize: 10, letterSpacing: '0.05em', textAlign: 'left', fontWeight: 600, padding: '4px 6px' }
const TD_STYLE = { padding: '2px 4px', verticalAlign: 'middle' }
const READ_STYLE = { fontSize: 12, padding: '0 6px', color: 'var(--component-color)' }

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// A muted em-dash placeholder for empty read-only cells.
const Dash = () => <span style={{ color: 'var(--panel-border)' }}>—</span>

// One pin cell: editable input while editing, plain text in read-only view.
// Module-level (NOT defined inside PlcDevicePage's render) so its identity stays
// stable across re-renders — otherwise React remounts the <input> on every
// keystroke and focus is lost after one character.
function PinField({ pin, devId, field, placeholder, editing, devices, commit }) {
  if (!editing) {
    return <div style={READ_STYLE}>{pin[field] ? pin[field] : <Dash />}</div>
  }
  return (
    <input className={INPUT_CLASS} style={INPUT_STYLE} value={pin[field] ?? ''} placeholder={placeholder}
      onChange={e => commit(updatePin(devices, devId, pin.id, { [field]: e.target.value }))} />
  )
}

const chipStyle = on => ({
  fontSize: 9, height: 18, lineHeight: '16px',
  border: '1px solid var(--panel-border)',
  background: on ? 'rgba(37,99,235,0.15)' : 'transparent',
  color: on ? '#2563eb' : 'var(--component-color)',
  fontWeight: on ? 700 : 400, opacity: on ? 1 : 0.55,
})

// Capability chips: what the pin *can* do, independent of the single `kind` it's
// configured as. Read-only mode shows only the enabled chips as a compact line.
// Edit mode groups the (now 12) kinds by category — opened on demand via a small
// "Edit" affordance — so the table isn't one cluttered 12-chip row (issue #14).
function CapabilityChips({ pin, onToggle, readOnly }) {
  const [open, setOpen] = useState(false)
  const enabled = PIN_KINDS.filter(k => pinIsCapable(pin, k))
  if (readOnly) {
    if (enabled.length === 0) return <Dash />
    return (
      <div className="flex flex-wrap gap-0.5" style={{ maxWidth: 150 }}>
        {enabled.map(k => <span key={k} className="rounded px-1" style={chipStyle(true)}>{k}</span>)}
      </div>
    )
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} title="Edit capabilities"
        className="flex flex-wrap gap-0.5 items-center rounded px-1 hover:bg-black/5 dark:hover:bg-white/5"
        style={{ maxWidth: 150, minHeight: 18, border: '1px dashed var(--panel-border)' }}>
        {enabled.length
          ? enabled.map(k => <span key={k} className="rounded px-1" style={chipStyle(true)}>{k}</span>)
          : <span style={{ fontSize: 9, opacity: 0.6 }}>set…</span>}
      </button>
    )
  }
  return (
    <div className="rounded p-1" style={{ maxWidth: 170, border: '1px solid var(--panel-border)', background: 'var(--canvas-bg)' }}>
      {PIN_KIND_GROUPS.map(g => (
        <div key={g.label} className="flex items-center gap-1 mb-0.5">
          <span className="text-gray-400 flex-shrink-0" style={{ fontSize: 8, width: 44, textAlign: 'right' }}>{g.label}</span>
          <div className="flex flex-wrap gap-0.5">
            {g.kinds.map(k => (
              <button key={k} type="button" title={`Capable of ${k}`} onClick={() => onToggle(k)}
                className="rounded px-1" style={{ ...chipStyle(pinIsCapable(pin, k)), cursor: 'pointer' }}>{k}</button>
            ))}
          </div>
        </div>
      ))}
      <button type="button" onClick={() => setOpen(false)}
        className="text-blue-500" style={{ fontSize: 9 }}>Done</button>
    </div>
  )
}

// Full-page editor for the project's PLC hardware registry — opened from the
// "PLC Devices" entry in the file tree (or File → PLC Devices…). Reads like a
// documentation page: every device with its location, location photos, and a
// connector/pin list. Defaults to a clean read-only view; an Edit toggle
// unlocks inline editing. Placed DI/DO/AI/PWM components bind to these pins and
// the registry stays master (edits here flow live to the schematic).
export default function PlcDevicePage() {
  const projects = useSchematicStore(s => s.projects)
  const activeProjectId = useSchematicStore(s => s.activeProjectId)
  const setPlcDevices = useSchematicStore(s => s.setPlcDevices)
  const setPlcSignalMaster = useSchematicStore(s => s.setPlcSignalMaster)
  const project = projects.find(p => p.id === activeProjectId)
  const devices = project?.plcDevices || []
  const signalMaster = project?.plcSignalMaster || 'registry'

  const fileInputRef = useRef(null)
  const datasheetInputRef = useRef(null)
  const importInputRef = useRef(null)
  const pendingDeviceId = useRef(null)
  const [lightbox, setLightbox] = useState(null)
  const [docView, setDocView] = useState(null)   // datasheet being previewed inline (issue #27)
  const [editing, setEditing] = useState(false)
  const [sortMode, setSortMode] = useState('connector')
  // Device cards the user has minimised (so they don't scroll past 50 pins). Works
  // in both view and edit mode (issue #12).
  const [collapsed, setCollapsed] = useState(() => new Set())
  const toggleCollapsed = id => setCollapsed(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const commit = next => setPlcDevices(next)

  // Download a text payload, Tauri save dialog or browser blob.
  const downloadText = async (text, filename, ext, mime = 'text/plain') => {
    if (isRunningInTauri()) {
      const path = await saveFileDialog(filename, [{ name: ext.toUpperCase(), extensions: [ext] }])
      if (path) await writeTextFile(path, text)
    } else {
      const blob = new Blob([text], { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    }
  }
  const safeName = s => (s || 'plc-devices').replace(/[^\w.-]+/g, '_')

  const toggleCapability = (devId, pin, k) => {
    const caps = pinIsCapable(pin, k)
      ? (pin.capabilities || [pin.kind]).filter(c => c !== k)
      : [...new Set([...(pin.capabilities || [pin.kind]), k])]
    // The configured Type must stay one of the capabilities (issue #14): if the
    // removed cap was the current kind, fall back to the first remaining one.
    const patch = { capabilities: caps }
    if (caps.length && !caps.includes(pin.kind)) patch.kind = caps[0]
    commit(updatePin(devices, devId, pin.id, patch))
  }

  const pickImage = devId => {
    pendingDeviceId.current = devId
    fileInputRef.current?.click()
  }
  const onImagePicked = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    const devId = pendingDeviceId.current
    if (!file || !devId) return
    const src = await readFileAsDataUrl(file)
    commit(addDeviceImage(devices, devId, { src, heading: file.name }))
  }

  const exportCsv = () => downloadText(devicesToCsv(devices), `${safeName(project?.name)}-plc-devices.csv`, 'csv', 'text/csv')

  // Per-device export — carry one PLC config into another project. CSV is the
  // portable pin list; JSON is lossless (keeps the device's photos/datasheets).
  const exportDeviceCsv = dev => downloadText(deviceToCsv(dev), `${safeName(dev.name)}.csv`, 'csv', 'text/csv')
  const exportDeviceJson = dev => downloadText(deviceToJson(dev), `${safeName(dev.name)}.plcdev.json`, 'json', 'application/json')

  // Datasheet / docs picker (per device).
  const pickDatasheet = devId => { pendingDeviceId.current = devId; datasheetInputRef.current?.click() }
  const onDatasheetPicked = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    const devId = pendingDeviceId.current
    if (!file || !devId) return
    const data = await readFileAsDataUrl(file)
    commit(addDeviceDatasheet(devices, devId, { name: file.name, mime: file.type, data }))
  }
  // Datasheets are binary (the stored `data` is a base64 data URL). Writing the
  // URL string out as text produced a corrupt file (issue #27); decode to bytes
  // (Tauri) or hand the browser the data URL directly so it saves real content.
  const downloadDatasheet = async ds => {
    const ext = (ds.name.split('.').pop() || 'bin')
    if (isRunningInTauri()) {
      const path = await saveFileDialog(ds.name, [{ name: ext.toUpperCase(), extensions: [ext] }])
      if (path) await writeBinaryFile(path, dataUrlToBytes(ds.data))
    } else {
      const a = document.createElement('a')
      a.href = ds.data; a.download = ds.name; a.click()
    }
  }

  // Import a device config (CSV pin list or lossless JSON) into THIS project.
  const importDevices = () => importInputRef.current?.click()
  const onImportPicked = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const text = await file.text()
    let imported = []
    if (/\.json$/i.test(file.name)) {
      const d = deviceFromJson(text)
      if (d) imported = [d]
    } else {
      imported = csvToDevices(text)
    }
    if (!imported.length) { alert(`No PLC devices found in ${file.name}.`); return }
    commit(appendImportedDevices(devices, imported))
    if (!editing) setEditing(true)
  }

  // Reorder ▲/▼ only make sense against the stored order, so they appear only
  // when editing in 'manual' sort mode (any other sort derives the order).
  const showReorder = editing && sortMode === 'manual'

  return (
    <div className="flex-1 overflow-auto" style={{ background: 'var(--canvas-bg)', color: 'var(--component-color)' }}>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onImagePicked} />
      <input ref={datasheetInputRef} type="file" className="hidden" onChange={onDatasheetPicked} />
      <input ref={importInputRef} type="file" accept=".csv,.json" className="hidden" onChange={onImportPicked} />
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
      {docView && <DocViewer doc={docView} onClose={() => setDocView(null)} />}
      <div className="mx-auto px-6 py-5" style={{ maxWidth: 980 }}>
        {/* Page header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: 'var(--panel-border)' }}>
          <div>
            <div className="flex items-center gap-2 text-lg font-bold">
              <Cpu size={18} className="text-blue-500" /> PLC Devices
              {!editing && <span className="text-gray-400" style={{ fontSize: 11, fontWeight: 400 }}>· read-only</span>}
            </div>
            <div className="text-gray-400" style={{ fontSize: 12 }}>
              {project?.name ?? 'No project'} — define each device and its connector/pin list once;
              placed PLC inputs/outputs bind to a pin and stay in sync.
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Sort selector — re-order the pin lists by whatever you're after */}
            <label className="flex items-center gap-1 text-xs text-gray-400" title="Sort each device's pins">
              <ArrowUpDown size={12} />
              <select className="rounded border bg-transparent outline-none"
                style={{ ...INPUT_STYLE, width: 'auto', paddingRight: 4 }}
                value={sortMode} onChange={e => setSortMode(e.target.value)}>
                {PIN_SORT_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
            {/* Signal source of truth — who owns a bound symbol's name + I/O type */}
            <label className="flex items-center gap-1 text-xs text-gray-400" title="Where a bound PLC symbol's signal name + I/O type are edited">
              Signal master
              <select className="rounded border bg-transparent outline-none"
                style={{ ...INPUT_STYLE, width: 'auto', paddingRight: 4 }}
                value={signalMaster} onChange={e => setPlcSignalMaster(e.target.value)}>
                <option value="registry">PLC Manager</option>
                <option value="schematic">Schematic</option>
              </select>
            </label>
            <button
              className="text-xs px-3 py-1.5 rounded border flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/5"
              style={{ borderColor: 'var(--panel-border)' }}
              disabled={devices.length === 0}
              onClick={exportCsv}
            ><Download size={12} /> Export CSV</button>
            <button
              className="text-xs px-3 py-1.5 rounded border flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/5"
              style={{ borderColor: 'var(--panel-border)' }}
              onClick={importDevices}
            ><Upload size={12} /> Import</button>
            {editing && (
              <button
                className="text-xs px-3 py-1.5 rounded border flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/5"
                style={{ borderColor: 'var(--panel-border)' }}
                onClick={() => commit(addDevice(devices))}
              ><Plus size={12} /> Add Device</button>
            )}
            <button
              className="text-xs px-3 py-1.5 rounded border flex items-center gap-1.5"
              style={editing
                ? { borderColor: '#2563eb', background: 'rgba(37,99,235,0.12)', color: '#2563eb' }
                : { borderColor: 'var(--panel-border)' }}
              onClick={() => setEditing(v => !v)}
            >{editing ? <><Check size={12} /> Done</> : <><Pencil size={12} /> Edit</>}</button>
          </div>
        </div>

        {devices.length === 0 && (
          <div className="text-gray-400 text-center py-16" style={{ fontSize: 13 }}>
            No PLC devices defined yet.<br />
            {editing
              ? <>Click <b>Add Device</b> to describe your first PLC — name, location, and its pins.</>
              : <>Click <b>Edit</b>, then <b>Add Device</b> to describe your first PLC.</>}
          </div>
        )}

        <div className="space-y-5">
          {devices.map(dev => {
            const orderedPins = sortPins(dev, sortMode)
            const allPins = dev.pins || []
            const isCollapsed = collapsed.has(dev.id)
            const byConnector = sortMode === 'connector'
            // Build a flat list of render rows: connector sub-headings interleaved
            // with their pins when grouping, otherwise just the sorted pins.
            const pinRows = []
            if (byConnector) {
              for (const g of groupPinsByConnector(dev)) {
                pinRows.push({ group: g.connector || 'Unassigned' })
                for (const pin of g.pins) pinRows.push({ pin })
              }
            } else {
              for (const pin of orderedPins) pinRows.push({ pin })
            }
            const colSpan = 8 + (showReorder ? 1 : 0) + (editing ? 1 : 0)
            return (
            <div key={dev.id} className="rounded-lg border" style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-bg)' }}>
              {/* Device header */}
              <div className="flex items-center gap-3 px-4 py-3" style={isCollapsed ? undefined : { borderBottom: '1px solid var(--panel-border)' }}>
                <button className="px-0.5 rounded text-gray-400 hover:text-blue-500 flex-shrink-0"
                  title={isCollapsed ? 'Expand' : 'Minimise'} onClick={() => toggleCollapsed(dev.id)}>
                  {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                </button>
                <Cpu size={15} className="text-blue-500 flex-shrink-0" />
                <label className="flex items-center gap-1.5 min-w-0" style={{ flex: '1.2 1 0' }}>
                  <span className="text-gray-400 flex-shrink-0" style={{ fontSize: 10 }}>Device</span>
                  {editing ? (
                    <input className={`${INPUT_CLASS} font-semibold`} style={{ ...INPUT_STYLE, fontSize: 14 }}
                      value={dev.name} placeholder="e.g. PLC1"
                      onChange={e => commit(updateDevice(devices, dev.id, { name: e.target.value }))} />
                  ) : (
                    <span className="font-semibold truncate" style={{ fontSize: 14 }}>{dev.name || <Dash />}</span>
                  )}
                </label>
                <label className="flex items-center gap-1.5 min-w-0" style={{ flex: '1 1 0' }}>
                  <span className="text-gray-400 flex-shrink-0" style={{ fontSize: 10 }}>Location</span>
                  {editing ? (
                    <input className={INPUT_CLASS} style={INPUT_STYLE}
                      value={dev.location} placeholder="e.g. Cabinet A"
                      onChange={e => commit(updateDevice(devices, dev.id, { location: e.target.value }))} />
                  ) : (
                    <span className="truncate" style={{ fontSize: 12 }}>{dev.location || <Dash />}</span>
                  )}
                </label>
                {/* Per-device config lock (issue #30): where this device's bound
                    symbols can have their signal name + I/O type edited. */}
                {editing ? (
                  <label className="flex items-center gap-1.5 flex-shrink-0" title="Where this device's signals can be edited">
                    <span className="text-gray-400" style={{ fontSize: 10 }}>Config</span>
                    <select className={INPUT_CLASS} style={{ ...INPUT_STYLE, width: 'auto' }}
                      value={dev.signalMaster || 'inherit'}
                      onChange={e => commit(updateDevice(devices, dev.id, { signalMaster: e.target.value }))}>
                      <option value="inherit">Project default</option>
                      <option value="schematic">Editable on schematic</option>
                      <option value="registry">Locked to this page</option>
                    </select>
                  </label>
                ) : (dev.signalMaster && dev.signalMaster !== 'inherit') && (
                  <span className="flex-shrink-0 rounded px-1.5 py-0.5" style={{ fontSize: 10, background: 'rgba(37,99,235,0.1)', color: '#2563eb' }}>
                    {dev.signalMaster === 'schematic' ? 'Schematic-editable' : 'Locked here'}
                  </span>
                )}
                {isCollapsed && (
                  <span className="text-gray-400 flex-shrink-0" style={{ fontSize: 11 }}>
                    {allPins.length} pin{allPins.length === 1 ? '' : 's'}
                  </span>
                )}
                {/* Download this single device's config to reuse elsewhere */}
                <button
                  className="px-1.5 py-1 rounded text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0"
                  title="Download this device as CSV (portable pin list)"
                  onClick={() => exportDeviceCsv(dev)}
                ><Download size={14} /></button>
                <button
                  className="px-1.5 py-1 rounded text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0"
                  title="Download this device as JSON (lossless — keeps photos/datasheets)"
                  onClick={() => exportDeviceJson(dev)}
                ><FileText size={14} /></button>
                {editing && (
                  <button
                    className="px-1.5 py-1 rounded text-red-400 hover:bg-red-500/10 flex-shrink-0"
                    title="Delete device"
                    onClick={() => { if (confirm(`Delete device “${dev.name}” and its pin list?`)) commit(removeDevice(devices, dev.id)) }}
                  ><Trash2 size={14} /></button>
                )}
              </div>

              {!isCollapsed && (<>
              {/* Location photos */}
              {(editing || (dev.images || []).length > 0) && (
                <div className="px-4 pt-3 flex items-center gap-2 flex-wrap">
                  {(dev.images || []).map(img => (
                    <div key={img.id} className="relative group">
                      <img src={img.src} alt={img.heading || 'location'} title={img.heading}
                        onClick={() => setLightbox(img.src)}
                        style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--panel-border)', cursor: 'zoom-in' }} />
                      {editing && (
                        <button
                          className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100"
                          style={{ width: 16, height: 16, fontSize: 10, lineHeight: '14px' }}
                          title="Remove photo"
                          onClick={() => commit(removeDeviceImage(devices, dev.id, img.id))}
                        >×</button>
                      )}
                    </div>
                  ))}
                  {editing && (
                    <button
                      className="flex flex-col items-center justify-center rounded border border-dashed text-gray-400 hover:bg-black/5 dark:hover:bg-white/5"
                      style={{ width: 64, height: 48, borderColor: 'var(--panel-border)', fontSize: 9 }}
                      title="Attach a photo of where this PLC sits"
                      onClick={() => pickImage(dev.id)}
                    ><ImagePlus size={14} /><span>Location</span></button>
                  )}
                </div>
              )}

              {/* Datasheets / docs + notes */}
              {(editing || (dev.datasheets || []).length > 0 || dev.notes) && (
                <div className="px-4 pt-3 space-y-2">
                  {(editing || (dev.datasheets || []).length > 0) && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-400" style={{ fontSize: 10 }}>Datasheets / docs</span>
                      {(dev.datasheets || []).map(ds => (
                        <span key={ds.id} className="inline-flex items-center gap-1 rounded border px-1.5"
                          style={{ borderColor: 'var(--panel-border)', fontSize: 11, height: 22 }}>
                          <button className="inline-flex items-center gap-1 hover:text-blue-500" title={`View ${ds.name}`}
                            onClick={() => setDocView(ds)}><FileText size={11} />{ds.name}</button>
                          <button className="text-gray-400 hover:text-blue-500" title={`Download ${ds.name}`}
                            onClick={() => downloadDatasheet(ds)}><Download size={11} /></button>
                          {editing && (
                            <button className="text-red-400 hover:text-red-500" title="Remove"
                              onClick={() => commit(removeDeviceDatasheet(devices, dev.id, ds.id))}>×</button>
                          )}
                        </span>
                      ))}
                      {editing && (
                        <button className="inline-flex items-center gap-1 rounded border border-dashed px-1.5 text-gray-400 hover:bg-black/5 dark:hover:bg-white/5"
                          style={{ borderColor: 'var(--panel-border)', fontSize: 11, height: 22 }}
                          title="Attach a datasheet or document"
                          onClick={() => pickDatasheet(dev.id)}><Plus size={11} /> Add doc</button>
                      )}
                    </div>
                  )}
                  {(editing || dev.notes) && (
                    <label className="flex items-start gap-1.5">
                      <span className="text-gray-400 flex-shrink-0" style={{ fontSize: 10, paddingTop: 3 }}>Notes</span>
                      {editing ? (
                        <textarea className="rounded px-1.5 py-1 outline-none bg-transparent border w-full" rows={2}
                          style={{ fontSize: 12, borderColor: 'var(--panel-border)', color: 'var(--component-color)' }}
                          value={dev.notes || ''} placeholder="Wiring notes, part number, supplier…"
                          onChange={e => commit(updateDevice(devices, dev.id, { notes: e.target.value }))} />
                      ) : (
                        <span style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{dev.notes}</span>
                      )}
                    </label>
                  )}
                </div>
              )}

              {/* Connector / pin list */}
              <div className="px-4 py-3">
                {orderedPins.length > 0 ? (
                  <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr className="text-gray-400 uppercase border-b" style={{ borderColor: 'var(--panel-border)' }}>
                        {showReorder && <th style={{ ...TH_STYLE, width: 44 }} />}
                        <th style={{ ...TH_STYLE, width: 72 }}>Connector</th>
                        <th style={{ ...TH_STYLE, width: 80 }}>Address</th>
                        <th style={{ ...TH_STYLE, width: 60 }}>Type</th>
                        <th style={{ ...TH_STYLE, width: 112 }}>Capable</th>
                        <th style={{ ...TH_STYLE, width: 64 }}>Channel</th>
                        <th style={{ ...TH_STYLE, width: 56 }}>Max A</th>
                        <th style={TH_STYLE}>Signal name</th>
                        <th style={TH_STYLE}>Notes</th>
                        {editing && <th style={{ width: 28 }} />}
                      </tr>
                    </thead>
                    <tbody>
                      {pinRows.map((item, ri) => {
                        if (item.group !== undefined) {
                          // Connector sub-heading (hierarchy when sorting by connector, issue #12).
                          return (
                            <tr key={`g${ri}`}>
                              <td colSpan={colSpan} style={{ padding: '8px 6px 2px', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: '#2563eb', textTransform: 'uppercase' }}>
                                {item.group}
                              </td>
                            </tr>
                          )
                        }
                        const pin = item.pin
                        const idx = allPins.indexOf(pin)
                        return (
                          <tr key={pin.id}>
                            {showReorder && (
                              <td style={TD_STYLE}>
                                <div className="flex flex-col">
                                  <button className="text-gray-400 hover:text-blue-500 disabled:opacity-25" title="Move up"
                                    disabled={idx === 0} onClick={() => commit(movePin(devices, dev.id, pin.id, -1))}><ChevronUp size={13} /></button>
                                  <button className="text-gray-400 hover:text-blue-500 disabled:opacity-25" title="Move down"
                                    disabled={idx === allPins.length - 1} onClick={() => commit(movePin(devices, dev.id, pin.id, 1))}><ChevronDown size={13} /></button>
                                </div>
                              </td>
                            )}
                            <td style={TD_STYLE}><PinField pin={pin} editing={editing} devices={devices} commit={commit} devId={dev.id} field="connector" placeholder="X1" /></td>
                            <td style={TD_STYLE}><PinField pin={pin} editing={editing} devices={devices} commit={commit} devId={dev.id} field="address" placeholder="I0.0" /></td>
                            <td style={TD_STYLE}>
                              {editing ? (
                                <select className={INPUT_CLASS} style={INPUT_STYLE} value={pin.kind}
                                  onChange={e => commit(updatePin(devices, dev.id, pin.id, { kind: e.target.value }))}>
                                  {(() => {
                                    // Only the kinds this pin is capable of, grouped by
                                    // category so the list isn't a flat 12-item clutter.
                                    const allowed = new Set(kindOptionsForPin(pin))
                                    return PIN_KIND_GROUPS
                                      .map(g => ({ label: g.label, kinds: g.kinds.filter(k => allowed.has(k)) }))
                                      .filter(g => g.kinds.length)
                                      .map(g => (
                                        <optgroup key={g.label} label={g.label}>
                                          {g.kinds.map(k => <option key={k} value={k}>{k}</option>)}
                                        </optgroup>
                                      ))
                                  })()}
                                </select>
                              ) : (
                                <div style={READ_STYLE}>{pin.kind || <Dash />}</div>
                              )}
                            </td>
                            <td style={TD_STYLE}>
                              <CapabilityChips pin={pin} readOnly={!editing} onToggle={k => toggleCapability(dev.id, pin, k)} />
                            </td>
                            <td style={TD_STYLE}><PinField pin={pin} editing={editing} devices={devices} commit={commit} devId={dev.id} field="channel" placeholder="CH1" /></td>
                            <td style={TD_STYLE}><PinField pin={pin} editing={editing} devices={devices} commit={commit} devId={dev.id} field="maxCurrent" placeholder="0.5" /></td>
                            <td style={TD_STYLE}><PinField pin={pin} editing={editing} devices={devices} commit={commit} devId={dev.id} field="name" placeholder="e.g. Start button" /></td>
                            <td style={TD_STYLE}><PinField pin={pin} editing={editing} devices={devices} commit={commit} devId={dev.id} field="notes" placeholder="" /></td>
                            {editing && (
                              <td style={TD_STYLE}>
                                <button className="px-1 py-0.5 rounded text-red-400 hover:bg-red-500/10" title="Remove pin"
                                  onClick={() => commit(removePin(devices, dev.id, pin.id))}><Trash2 size={12} /></button>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-gray-400 py-2" style={{ fontSize: 12 }}>No pins yet.</div>
                )}
                {editing && (
                  <button
                    className="mt-2 text-xs px-2.5 py-1 rounded border flex items-center gap-1 hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ borderColor: 'var(--panel-border)', fontSize: 11 }}
                    onClick={() => commit(addPin(devices, dev.id))}
                  ><Plus size={11} /> Add pin</button>
                )}
              </div>
              </>)}
            </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
