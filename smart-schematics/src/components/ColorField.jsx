import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { DEFAULT_SWATCHES, loadPresets, addPreset, removePreset, normalizeHex } from '../lib/colorPresets'

// Shared colour picker: a native colour input, a "default" reset, and a row of
// program-wide preset swatches (built-in defaults + user customs saved in
// localStorage via lib/colorPresets). Used for wire colour and component/symbol
// colour overrides so a palette built once is available everywhere.
//
// Props:
//   label     — small caption (default 'Colour')
//   value     — current hex ('' / undefined = no override → falls back to default)
//   onChange  — (hex) => void
//   onClear   — optional () => void; when present shows a "Default" button
export default function ColorField({ label = 'Colour', value, onChange, onClear }) {
  const [customs, setCustoms] = useState(loadPresets)
  const current = normalizeHex(value) || ''

  const pick = hex => onChange(hex)
  const saveCurrent = () => {
    if (!current) return
    setCustoms(addPreset(current))
  }
  const dropCustom = (e, hex) => {
    e.preventDefault()
    setCustoms(removePreset(hex))
  }

  const Swatch = ({ hex, removable }) => (
    <button
      type="button"
      title={removable ? `${hex} (right-click to remove)` : hex}
      onClick={() => pick(hex)}
      onContextMenu={removable ? e => dropCustom(e, hex) : undefined}
      className="rounded"
      style={{
        width: 16, height: 16, background: hex, cursor: 'pointer', padding: 0,
        border: current === hex ? '2px solid var(--component-color)' : '1px solid var(--panel-border)',
      }}
    />
  )

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-gray-400" style={{ fontSize: 10 }}>{label}</span>
        <input
          type="color"
          value={current || '#1e293b'}
          onChange={e => onChange(e.target.value)}
          style={{ width: 28, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
        />
        {onClear && value && (
          <button
            type="button"
            className="rounded px-1.5 py-0.5 hover:bg-black/5 dark:hover:bg-white/10"
            style={{ fontSize: 10, border: '1px solid var(--panel-border)', color: 'var(--component-color)' }}
            onClick={onClear}
            title="Use the default colour"
          >Default</button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {DEFAULT_SWATCHES.map(hex => <Swatch key={hex} hex={hex} />)}
        {customs.map(hex => <Swatch key={hex} hex={hex} removable />)}
        <button
          type="button"
          title="Save the current colour as a preset"
          onClick={saveCurrent}
          disabled={!current}
          className="rounded flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40"
          style={{ width: 16, height: 16, border: '1px dashed var(--panel-border)', color: 'var(--component-color)', cursor: current ? 'pointer' : 'default' }}
        ><Plus size={10} /></button>
      </div>
    </div>
  )
}
