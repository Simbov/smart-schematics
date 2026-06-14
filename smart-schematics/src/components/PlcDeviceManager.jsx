import React, { useRef, useState } from 'react'
import { Cpu, Plus, Trash2, ChevronUp, ChevronDown, Download, ImagePlus } from 'lucide-react'
import useSchematicStore from '../store/schematicStore'
import {
  addDevice, updateDevice, removeDevice,
  addPin, updatePin, removePin, movePin,
  addDeviceImage, removeDeviceImage,
  devicesToCsv, groupPinsByConnector, pinIsCapable,
  PIN_KINDS,
} from '../lib/plcDevices'
import { isRunningInTauri, saveFileDialog, writeTextFile } from '../lib/tauriFs'
import Lightbox from './Lightbox'

const INPUT_CLASS = 'rounded px-1.5 outline-none bg-transparent border w-full'
const INPUT_STYLE = { fontSize: 12, height: 24, borderColor: 'var(--panel-border)', color: 'var(--component-color)' }
const TH_STYLE = { fontSize: 10, letterSpacing: '0.05em', textAlign: 'left', fontWeight: 600, padding: '4px 6px' }
const TD_STYLE = { padding: '2px 4px', verticalAlign: 'middle' }

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// Capability chips: DI/DO/AI/PWM toggles for what the pin *can* do, independent
// of the single `kind` it's configured as.
function CapabilityChips({ pin, onToggle }) {
  return (
    <div className="flex gap-0.5">
      {PIN_KINDS.map(k => {
        const on = pinIsCapable(pin, k)
        return (
          <button key={k} type="button" title={`Capable of ${k}`}
            onClick={() => onToggle(k)}
            className="rounded px-1"
            style={{
              fontSize: 9, height: 18, lineHeight: '16px',
              border: '1px solid var(--panel-border)',
              background: on ? 'rgba(37,99,235,0.15)' : 'transparent',
              color: on ? '#2563eb' : 'var(--component-color)',
              fontWeight: on ? 700 : 400, opacity: on ? 1 : 0.55, cursor: 'pointer',
            }}
          >{k}</button>
        )
      })}
    </div>
  )
}

// Full-page editor for the project's PLC hardware registry — opened from the
// "PLC Devices" entry in the file tree (or File → PLC Devices…). Reads like a
// documentation page: every device with its location, location photos, and a
// connector/pin list. Placed DI/DO/AI/PWM components bind to these pins and the
// registry stays master (edits here flow live to the schematic).
export default function PlcDevicePage() {
  const projects = useSchematicStore(s => s.projects)
  const activeProjectId = useSchematicStore(s => s.activeProjectId)
  const setPlcDevices = useSchematicStore(s => s.setPlcDevices)
  const project = projects.find(p => p.id === activeProjectId)
  const devices = project?.plcDevices || []

  const fileInputRef = useRef(null)
  const pendingDeviceId = useRef(null)
  const [lightbox, setLightbox] = useState(null)

  const commit = next => setPlcDevices(next)

  const toggleCapability = (devId, pin, k) => {
    const caps = pinIsCapable(pin, k)
      ? (pin.capabilities || [pin.kind]).filter(c => c !== k)
      : [...new Set([...(pin.capabilities || [pin.kind]), k])]
    commit(updatePin(devices, devId, pin.id, { capabilities: caps }))
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

  const exportCsv = async () => {
    const csv = devicesToCsv(devices)
    const name = `${(project?.name || 'plc-devices').replace(/[^\w.-]+/g, '_')}-plc-devices.csv`
    if (isRunningInTauri()) {
      const path = await saveFileDialog(name, [{ name: 'CSV', extensions: ['csv'] }])
      if (path) await writeTextFile(path, csv)
    } else {
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = name; a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="flex-1 overflow-auto" style={{ background: 'var(--canvas-bg)', color: 'var(--component-color)' }}>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onImagePicked} />
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
      <div className="mx-auto px-6 py-5" style={{ maxWidth: 920 }}>
        {/* Page header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: 'var(--panel-border)' }}>
          <div>
            <div className="flex items-center gap-2 text-lg font-bold">
              <Cpu size={18} className="text-blue-500" /> PLC Devices
            </div>
            <div className="text-gray-400" style={{ fontSize: 12 }}>
              {project?.name ?? 'No project'} — define each device and its connector/pin list once;
              placed PLC inputs/outputs bind to a pin and stay in sync.
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              className="text-xs px-3 py-1.5 rounded border flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/5"
              style={{ borderColor: 'var(--panel-border)' }}
              disabled={devices.length === 0}
              onClick={exportCsv}
            ><Download size={12} /> Export CSV</button>
            <button
              className="text-xs px-3 py-1.5 rounded border flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/5"
              style={{ borderColor: 'var(--panel-border)' }}
              onClick={() => commit(addDevice(devices))}
            ><Plus size={12} /> Add Device</button>
          </div>
        </div>

        {devices.length === 0 && (
          <div className="text-gray-400 text-center py-16" style={{ fontSize: 13 }}>
            No PLC devices defined yet.<br />
            Click <b>Add Device</b> to describe your first PLC — name, location, and its pins.
          </div>
        )}

        <div className="space-y-5">
          {devices.map(dev => {
            const pins = dev.pins || []
            const groups = groupPinsByConnector(dev)
            return (
            <div key={dev.id} className="rounded-lg border" style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-bg)' }}>
              {/* Device header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--panel-border)' }}>
                <Cpu size={15} className="text-blue-500 flex-shrink-0" />
                <label className="flex items-center gap-1.5 min-w-0" style={{ flex: '1.2 1 0' }}>
                  <span className="text-gray-400 flex-shrink-0" style={{ fontSize: 10 }}>Device</span>
                  <input className={`${INPUT_CLASS} font-semibold`} style={{ ...INPUT_STYLE, fontSize: 14 }}
                    value={dev.name} placeholder="e.g. PLC1"
                    onChange={e => commit(updateDevice(devices, dev.id, { name: e.target.value }))} />
                </label>
                <label className="flex items-center gap-1.5 min-w-0" style={{ flex: '1 1 0' }}>
                  <span className="text-gray-400 flex-shrink-0" style={{ fontSize: 10 }}>Location</span>
                  <input className={INPUT_CLASS} style={INPUT_STYLE}
                    value={dev.location} placeholder="e.g. Cabinet A"
                    onChange={e => commit(updateDevice(devices, dev.id, { location: e.target.value }))} />
                </label>
                <button
                  className="px-1.5 py-1 rounded text-red-400 hover:bg-red-500/10 flex-shrink-0"
                  title="Delete device"
                  onClick={() => { if (confirm(`Delete device “${dev.name}” and its pin list?`)) commit(removeDevice(devices, dev.id)) }}
                ><Trash2 size={14} /></button>
              </div>

              {/* Location photos */}
              <div className="px-4 pt-3 flex items-center gap-2 flex-wrap">
                {(dev.images || []).map(img => (
                  <div key={img.id} className="relative group">
                    <img src={img.src} alt={img.heading || 'location'} title={img.heading}
                      onClick={() => setLightbox(img.src)}
                      style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--panel-border)', cursor: 'zoom-in' }} />
                    <button
                      className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100"
                      style={{ width: 16, height: 16, fontSize: 10, lineHeight: '14px' }}
                      title="Remove photo"
                      onClick={() => commit(removeDeviceImage(devices, dev.id, img.id))}
                    >×</button>
                  </div>
                ))}
                <button
                  className="flex flex-col items-center justify-center rounded border border-dashed text-gray-400 hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ width: 64, height: 48, borderColor: 'var(--panel-border)', fontSize: 9 }}
                  title="Attach a photo of where this PLC sits"
                  onClick={() => pickImage(dev.id)}
                ><ImagePlus size={14} /><span>Location</span></button>
              </div>

              {/* Connector / pin list */}
              <div className="px-4 py-3">
                {pins.length > 0 ? (
                  <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr className="text-gray-400 uppercase border-b" style={{ borderColor: 'var(--panel-border)' }}>
                        <th style={{ ...TH_STYLE, width: 44 }} />
                        <th style={{ ...TH_STYLE, width: 84 }}>Address</th>
                        <th style={{ ...TH_STYLE, width: 64 }}>Type</th>
                        <th style={{ ...TH_STYLE, width: 116 }}>Capable</th>
                        <th style={{ ...TH_STYLE, width: 70 }}>Channel</th>
                        <th style={TH_STYLE}>Signal name</th>
                        <th style={TH_STYLE}>Notes</th>
                        <th style={{ width: 28 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map(group => (
                        <React.Fragment key={group.connector || '__none__'}>
                          {/* Connector subheader — reads like a real connector/pin list */}
                          <tr>
                            <td colSpan={8} style={{ padding: '6px 6px 2px' }}>
                              <span className="text-gray-400" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}>
                                {group.connector ? `Connector ${group.connector}` : 'Unassigned'}
                              </span>
                            </td>
                          </tr>
                          {group.pins.map(pin => {
                            const idx = pins.indexOf(pin)
                            return (
                            <tr key={pin.id}>
                              <td style={TD_STYLE}>
                                <div className="flex flex-col">
                                  <button className="text-gray-400 hover:text-blue-500 disabled:opacity-25" title="Move up"
                                    disabled={idx === 0} onClick={() => commit(movePin(devices, dev.id, pin.id, -1))}><ChevronUp size={13} /></button>
                                  <button className="text-gray-400 hover:text-blue-500 disabled:opacity-25" title="Move down"
                                    disabled={idx === pins.length - 1} onClick={() => commit(movePin(devices, dev.id, pin.id, 1))}><ChevronDown size={13} /></button>
                                </div>
                              </td>
                              <td style={TD_STYLE}>
                                <input className={INPUT_CLASS} style={INPUT_STYLE} value={pin.address} placeholder="I0.0"
                                  onChange={e => commit(updatePin(devices, dev.id, pin.id, { address: e.target.value }))} />
                              </td>
                              <td style={TD_STYLE}>
                                <select className={INPUT_CLASS} style={INPUT_STYLE} value={pin.kind}
                                  onChange={e => commit(updatePin(devices, dev.id, pin.id, { kind: e.target.value }))}>
                                  {PIN_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                                </select>
                              </td>
                              <td style={TD_STYLE}>
                                <CapabilityChips pin={pin} onToggle={k => toggleCapability(dev.id, pin, k)} />
                              </td>
                              <td style={TD_STYLE}>
                                <input className={INPUT_CLASS} style={INPUT_STYLE} value={pin.channel ?? ''} placeholder="CH1"
                                  onChange={e => commit(updatePin(devices, dev.id, pin.id, { channel: e.target.value }))} />
                              </td>
                              <td style={TD_STYLE}>
                                <input className={INPUT_CLASS} style={INPUT_STYLE} value={pin.name} placeholder="e.g. Start button"
                                  onChange={e => commit(updatePin(devices, dev.id, pin.id, { name: e.target.value }))} />
                              </td>
                              <td style={TD_STYLE}>
                                <input className={INPUT_CLASS} style={INPUT_STYLE} value={pin.notes}
                                  onChange={e => commit(updatePin(devices, dev.id, pin.id, { notes: e.target.value }))} />
                              </td>
                              <td style={TD_STYLE}>
                                <button className="px-1 py-0.5 rounded text-red-400 hover:bg-red-500/10" title="Remove pin"
                                  onClick={() => commit(removePin(devices, dev.id, pin.id))}><Trash2 size={12} /></button>
                              </td>
                            </tr>
                            )
                          })}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-gray-400 py-2" style={{ fontSize: 12 }}>No pins yet.</div>
                )}
                <button
                  className="mt-2 text-xs px-2.5 py-1 rounded border flex items-center gap-1 hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ borderColor: 'var(--panel-border)', fontSize: 11 }}
                  onClick={() => commit(addPin(devices, dev.id))}
                ><Plus size={11} /> Add pin</button>
              </div>
            </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
