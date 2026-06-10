import React from 'react'
import { Cpu, Plus, Trash2 } from 'lucide-react'
import useSchematicStore from '../store/schematicStore'
import { addDevice, updateDevice, removeDevice, addPin, updatePin, removePin, PIN_KINDS } from '../lib/plcDevices'

const INPUT_CLASS = 'rounded px-1.5 outline-none bg-transparent border w-full'
const INPUT_STYLE = { fontSize: 12, height: 24, borderColor: 'var(--panel-border)', color: 'var(--component-color)' }
const TH_STYLE = { fontSize: 10, letterSpacing: '0.05em', textAlign: 'left', fontWeight: 600, padding: '4px 6px' }
const TD_STYLE = { padding: '2px 4px' }

// Full-page editor for the project's PLC hardware registry — opened from the
// "PLC Devices" entry in the file tree (or File → PLC Devices…). Rendered in
// place of the canvas, so it reads like a documentation page of the project:
// every device with its location and a connector/pin list. Placed DI/DO/AI/PWM
// components bind to these pins in their Properties and auto-populate.
export default function PlcDevicePage() {
  const projects = useSchematicStore(s => s.projects)
  const activeProjectId = useSchematicStore(s => s.activeProjectId)
  const setPlcDevices = useSchematicStore(s => s.setPlcDevices)
  const project = projects.find(p => p.id === activeProjectId)
  const devices = project?.plcDevices || []

  const commit = next => setPlcDevices(next)

  return (
    <div className="flex-1 overflow-auto" style={{ background: 'var(--canvas-bg)', color: 'var(--component-color)' }}>
      <div className="mx-auto px-6 py-5" style={{ maxWidth: 860 }}>
        {/* Page header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: 'var(--panel-border)' }}>
          <div>
            <div className="flex items-center gap-2 text-lg font-bold">
              <Cpu size={18} className="text-blue-500" /> PLC Devices
            </div>
            <div className="text-gray-400" style={{ fontSize: 12 }}>
              {project?.name ?? 'No project'} — define each device and its connector/pin list once;
              placed PLC inputs/outputs pick a pin and fill themselves in.
            </div>
          </div>
          <button
            className="text-xs px-3 py-1.5 rounded border flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0"
            style={{ borderColor: 'var(--panel-border)' }}
            onClick={() => commit(addDevice(devices))}
          ><Plus size={12} /> Add Device</button>
        </div>

        {devices.length === 0 && (
          <div className="text-gray-400 text-center py-16" style={{ fontSize: 13 }}>
            No PLC devices defined yet.<br />
            Click <b>Add Device</b> to describe your first PLC — name, location, and its pins.
          </div>
        )}

        <div className="space-y-5">
          {devices.map(dev => (
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

              {/* Connector / pin list */}
              <div className="px-4 py-3">
                {(dev.pins || []).length > 0 ? (
                  <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr className="text-gray-400 uppercase border-b" style={{ borderColor: 'var(--panel-border)' }}>
                        <th style={{ ...TH_STYLE, width: 90 }}>Address</th>
                        <th style={{ ...TH_STYLE, width: 70 }}>Type</th>
                        <th style={{ ...TH_STYLE, width: 90 }}>Connector</th>
                        <th style={TH_STYLE}>Signal name</th>
                        <th style={TH_STYLE}>Notes</th>
                        <th style={{ width: 28 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {dev.pins.map(pin => (
                        <tr key={pin.id}>
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
                            <input className={INPUT_CLASS} style={INPUT_STYLE} value={pin.connector ?? ''} placeholder="X1"
                              onChange={e => commit(updatePin(devices, dev.id, pin.id, { connector: e.target.value }))} />
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
          ))}
        </div>
      </div>
    </div>
  )
}
