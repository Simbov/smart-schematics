import React, { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { loadCustomComponents, saveCustomComponents } from '../lib/components/custom'
import CustomSymbol from '../lib/symbols/CustomSymbol'

function genTypeSlug(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'component'
  return `custom_${slug}_${Date.now()}`
}

export default function CustomComponentModal({ onClose, onSaved }) {
  const [name, setName] = useState('')
  const [svgPathData, setSvgPathData] = useState('')
  const [pins, setPins] = useState([
    { id: 'A', relX: -20, relY: 0, direction: 'W' },
    { id: 'B', relX: 20, relY: 0, direction: 'E' },
  ])
  const [error, setError] = useState('')

  const addPin = () => setPins(p => [...p, { id: '', relX: 0, relY: 0, direction: 'N' }])
  const removePin = (i) => setPins(p => p.filter((_, idx) => idx !== i))
  const updatePin = (i, key, value) => setPins(p => p.map((pin, idx) => idx === i ? { ...pin, [key]: value } : pin))

  const handleSave = () => {
    if (!name.trim()) { setError('Name is required.'); return }
    if (!svgPathData.trim()) { setError('SVG path data is required.'); return }

    const newDef = {
      type: genTypeSlug(name.trim()),
      label: name.trim(),
      category: 'Custom',
      schematicType: 'custom',
      defaultDesignatorPrefix: name.trim().replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || 'X',
      defaultValue: '',
      width: 40,
      height: 40,
      viewBox: '-20 -20 40 40',
      svgPathData: svgPathData.trim(),
      pins: pins.map(p => ({
        id: p.id || 'P',
        relX: Number(p.relX) || 0,
        relY: Number(p.relY) || 0,
        direction: p.direction || 'N',
      })),
      simParams: {},
    }

    saveCustomComponents([...loadCustomComponents(), newDef])
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="rounded-lg shadow-xl flex flex-col"
        style={{
          background: 'var(--panel-bg)',
          border: '1px solid var(--panel-border)',
          width: 480,
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--panel-border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--component-color)' }}>Add Custom Component</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--component-color)' }}>Name</label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder="e.g. My Valve"
              className="w-full px-2 py-1.5 text-xs rounded border outline-none focus:border-blue-500 bg-transparent"
              style={{ borderColor: 'var(--panel-border)', color: 'var(--component-color)' }}
            />
          </div>

          {/* SVG input */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--component-color)' }}>
              SVG Path Data <span className="text-gray-400 font-normal">(d= attribute value or SVG snippet)</span>
            </label>
            <textarea
              value={svgPathData}
              onChange={e => { setSvgPathData(e.target.value); setError('') }}
              placeholder={'Path data:  M -20 0 L 20 0\nSVG snippet: <circle r="10" />'}
              rows={4}
              className="w-full px-2 py-1.5 text-xs rounded border outline-none focus:border-blue-500 bg-transparent font-mono"
              style={{ borderColor: 'var(--panel-border)', color: 'var(--component-color)', resize: 'vertical' }}
            />
          </div>

          {/* Live preview */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--component-color)' }}>Preview</label>
            <div
              className="rounded border flex items-center justify-center"
              style={{ borderColor: 'var(--panel-border)', background: 'var(--canvas-bg)', height: 90 }}
            >
              <svg width="90" height="70" viewBox="-20 -20 40 40" style={{ color: 'var(--component-color)', overflow: 'visible' }}>
                {svgPathData.trim() && <CustomSymbol svgPathData={svgPathData} />}
                {pins.map((pin, i) => (
                  <circle
                    key={i}
                    cx={Number(pin.relX) || 0}
                    cy={Number(pin.relY) || 0}
                    r={2}
                    fill="rgba(37,99,235,0.7)"
                    stroke="#2563eb"
                    strokeWidth="0.5"
                  />
                ))}
              </svg>
            </div>
          </div>

          {/* Pin rows */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium" style={{ color: 'var(--component-color)' }}>Pins</label>
              <button
                onClick={addPin}
                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
              >
                <Plus size={12} /> Add Pin
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="grid text-xs text-gray-400 gap-1" style={{ gridTemplateColumns: '1fr 1.2fr 1.2fr 0.8fr auto' }}>
                <span className="px-1">ID</span>
                <span className="px-1">relX</span>
                <span className="px-1">relY</span>
                <span className="px-1">Dir</span>
                <span />
              </div>
              {pins.map((pin, i) => (
                <div key={i} className="grid gap-1 items-center" style={{ gridTemplateColumns: '1fr 1.2fr 1.2fr 0.8fr auto' }}>
                  <input
                    value={pin.id}
                    onChange={e => updatePin(i, 'id', e.target.value)}
                    className="px-1 py-0.5 text-xs rounded border bg-transparent"
                    style={{ borderColor: 'var(--panel-border)', color: 'var(--component-color)' }}
                    placeholder="A"
                  />
                  <input
                    type="number"
                    value={pin.relX}
                    onChange={e => updatePin(i, 'relX', e.target.value)}
                    className="px-1 py-0.5 text-xs rounded border bg-transparent"
                    style={{ borderColor: 'var(--panel-border)', color: 'var(--component-color)' }}
                  />
                  <input
                    type="number"
                    value={pin.relY}
                    onChange={e => updatePin(i, 'relY', e.target.value)}
                    className="px-1 py-0.5 text-xs rounded border bg-transparent"
                    style={{ borderColor: 'var(--panel-border)', color: 'var(--component-color)' }}
                  />
                  <select
                    value={pin.direction}
                    onChange={e => updatePin(i, 'direction', e.target.value)}
                    className="px-1 py-0.5 text-xs rounded border bg-transparent"
                    style={{ borderColor: 'var(--panel-border)', color: 'var(--component-color)' }}
                  >
                    <option value="N">N</option>
                    <option value="S">S</option>
                    <option value="E">E</option>
                    <option value="W">W</option>
                  </select>
                  <button onClick={() => removePin(i)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t flex-shrink-0" style={{ borderColor: 'var(--panel-border)' }}>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border"
            style={{ borderColor: 'var(--panel-border)', color: 'var(--component-color)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-xs rounded bg-blue-500 text-white hover:bg-blue-600"
          >
            Save Component
          </button>
        </div>
      </div>
    </div>
  )
}
