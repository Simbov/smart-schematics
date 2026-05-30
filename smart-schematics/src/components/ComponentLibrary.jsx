import React, { useState, useMemo, useCallback } from 'react'
import { Search, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import useSchematicStore from '../store/schematicStore'
import { ELECTRICAL_COMPONENTS } from '../lib/components/electrical'
import { ELECTRICAL_SYMBOL_MAP } from '../lib/symbols/electrical'
import { HYDRAULIC_COMPONENTS } from '../lib/components/hydraulic'
import { HYDRAULIC_SYMBOL_MAP } from '../lib/symbols/HydraulicSymbols'
import { loadCustomComponents, saveCustomComponents } from '../lib/components/custom'
import CustomSymbol from '../lib/symbols/CustomSymbol'
import CustomComponentModal from './CustomComponentModal'

const SYMBOL_MAP_COMBINED = { ...ELECTRICAL_SYMBOL_MAP, ...HYDRAULIC_SYMBOL_MAP }

function ComponentCard({ def, onPlace }) {
  const SymbolComponent = SYMBOL_MAP_COMBINED[def.type]

  return (
    <button
      className="flex flex-col items-center gap-1 p-2 rounded border hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group"
      style={{ borderColor: 'var(--panel-border)' }}
      onClick={() => onPlace(def.type)}
      title={def.label}
    >
      <svg
        width="56"
        height="36"
        viewBox={def.viewBox || '-22 -14 44 28'}
        style={{ color: 'var(--component-color)', overflow: 'visible' }}
      >
        {SymbolComponent ? <SymbolComponent /> : (
          <text fontSize="8" textAnchor="middle" fill="currentColor">{def.type}</text>
        )}
      </svg>
      <span
        className="text-center leading-tight"
        style={{ fontSize: 10, color: 'var(--component-color)', lineHeight: 1.2 }}
      >
        {def.label}
      </span>
    </button>
  )
}

function CustomComponentCard({ def, onPlace, onDelete }) {
  return (
    <div
      className="flex flex-col items-center gap-1 p-2 rounded border transition-colors group relative"
      style={{ borderColor: 'var(--panel-border)' }}
    >
      <button
        className="absolute top-1 right-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={e => { e.stopPropagation(); onDelete(def.type) }}
        title="Delete component"
      >
        <Trash2 size={10} />
      </button>
      <button
        className="flex flex-col items-center gap-1 w-full"
        onClick={() => onPlace(def.type)}
        title={def.label}
      >
        <svg
          width="56"
          height="36"
          viewBox={def.viewBox || '-20 -20 40 40'}
          style={{ color: 'var(--component-color)', overflow: 'visible' }}
        >
          <CustomSymbol svgPathData={def.svgPathData} />
        </svg>
        <span
          className="text-center leading-tight"
          style={{ fontSize: 10, color: 'var(--component-color)', lineHeight: 1.2 }}
        >
          {def.label}
        </span>
      </button>
    </div>
  )
}

export default function ComponentLibrary() {
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('electrical')
  const [customComponents, setCustomComponents] = useState(() => loadCustomComponents())
  const [showModal, setShowModal] = useState(false)
  const startPlacing = useSchematicStore(s => s.startPlacing)

  const reloadCustom = useCallback(() => {
    setCustomComponents(loadCustomComponents())
  }, [])

  const handleDeleteCustom = useCallback((type) => {
    const updated = loadCustomComponents().filter(d => d.type !== type)
    saveCustomComponents(updated)
    setCustomComponents(updated)
  }, [])

  const electricalFiltered = useMemo(() => {
    const q = search.toLowerCase()
    return ELECTRICAL_COMPONENTS.filter(def =>
      !q ||
      def.label.toLowerCase().includes(q) ||
      def.type.toLowerCase().includes(q) ||
      def.tags?.some(t => t.toLowerCase().includes(q))
    )
  }, [search])

  const electricalByCategory = useMemo(() => {
    const map = new Map()
    electricalFiltered.forEach(def => {
      const cat = def.category || 'Other'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat).push(def)
    })
    return map
  }, [electricalFiltered])

  const hydraulicFiltered = useMemo(() => {
    const q = search.toLowerCase()
    return HYDRAULIC_COMPONENTS.filter(def =>
      !q ||
      def.label.toLowerCase().includes(q) ||
      def.type.toLowerCase().includes(q) ||
      def.tags?.some(t => t.toLowerCase().includes(q))
    )
  }, [search])

  const hydraulicByCategory = useMemo(() => {
    const map = new Map()
    hydraulicFiltered.forEach(def => {
      const cat = def.category || 'Other'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat).push(def)
    })
    return map
  }, [hydraulicFiltered])

  const customFiltered = useMemo(() => {
    const q = search.toLowerCase()
    return customComponents.filter(def =>
      !q ||
      def.label.toLowerCase().includes(q) ||
      def.type.toLowerCase().includes(q)
    )
  }, [search, customComponents])

  const handlePlace = (type) => {
    startPlacing(type)
  }

  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center py-2 border-l flex-shrink-0"
        style={{
          width: 24,
          background: 'var(--toolbar-bg)',
          borderColor: 'var(--panel-border)',
        }}
      >
        <button
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          onClick={() => setCollapsed(false)}
          title="Show Component Library"
        >
          <ChevronLeft size={14} />
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col border-l flex-shrink-0"
      style={{
        width: 220,
        background: 'var(--panel-bg)',
        borderColor: 'var(--panel-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0"
        style={{ borderColor: 'var(--panel-border)' }}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Components</span>
        <button
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          onClick={() => setCollapsed(true)}
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--panel-border)' }}>
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full pl-6 pr-2 py-1 text-xs rounded border bg-transparent outline-none focus:border-blue-500"
            style={{ borderColor: 'var(--panel-border)', color: 'var(--component-color)' }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b flex-shrink-0" style={{ borderColor: 'var(--panel-border)' }}>
        {['electrical', 'hydraulic', 'custom'].map(t => (
          <button
            key={t}
            className="flex-1 py-1.5 text-xs capitalize transition-colors"
            style={{
              color: tab === t ? '#2563eb' : '#6b7280',
              borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent',
            }}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Component grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {tab === 'electrical' && (
          electricalFiltered.length === 0
            ? <p className="text-xs text-gray-400 text-center mt-8">No components found.</p>
            : search
              ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {electricalFiltered.map(def => (
                    <ComponentCard key={def.type} def={def} onPlace={handlePlace} />
                  ))}
                </div>
              )
              : (
                <div className="flex flex-col gap-3">
                  {[...electricalByCategory.entries()].map(([cat, defs]) => (
                    <div key={cat}>
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">{cat}</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {defs.map(def => (
                          <ComponentCard key={def.type} def={def} onPlace={handlePlace} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
        )}
        {tab === 'hydraulic' && (
          hydraulicFiltered.length === 0
            ? <p className="text-xs text-gray-400 text-center mt-8">No components found.</p>
            : search
              ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {hydraulicFiltered.map(def => (
                    <ComponentCard key={def.type} def={def} onPlace={handlePlace} />
                  ))}
                </div>
              )
              : (
                <div className="flex flex-col gap-3">
                  {[...hydraulicByCategory.entries()].map(([cat, defs]) => (
                    <div key={cat}>
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">{cat}</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {defs.map(def => (
                          <ComponentCard key={def.type} def={def} onPlace={handlePlace} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
        )}
        {tab === 'custom' && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded border border-dashed text-xs text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              style={{ borderColor: '#2563eb' }}
            >
              <Plus size={12} /> Add Custom Component
            </button>
            {customFiltered.length === 0
              ? <p className="text-xs text-gray-400 text-center mt-4">No custom components yet.</p>
              : (
                <div className="grid grid-cols-2 gap-1.5">
                  {customFiltered.map(def => (
                    <CustomComponentCard
                      key={def.type}
                      def={def}
                      onPlace={handlePlace}
                      onDelete={handleDeleteCustom}
                    />
                  ))}
                </div>
              )
            }
          </div>
        )}
      </div>

      {/* Place instruction */}
      <div
        className="px-3 py-2 border-t text-xs text-gray-400"
        style={{ borderColor: 'var(--panel-border)' }}
      >
        Click a component, then click the canvas to place. Press Esc to cancel.
      </div>

      {showModal && (
        <CustomComponentModal
          onClose={() => setShowModal(false)}
          onSaved={reloadCustom}
        />
      )}
    </div>
  )
}
