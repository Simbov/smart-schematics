import React, { useState, useEffect } from 'react'
import useSchematicStore from '../store/schematicStore'
import useSimulationStore from '../store/simulationStore'
import { basename } from '../lib/tauriFs'

function useRelativeTime(ts) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    if (!ts) { setLabel(''); return }
    const update = () => {
      const s = Math.floor((Date.now() - ts) / 1000)
      if (s < 5) setLabel('just now')
      else if (s < 60) setLabel(`${s}s ago`)
      else if (s < 3600) setLabel(`${Math.floor(s / 60)}m ago`)
      else setLabel(`${Math.floor(s / 3600)}h ago`)
    }
    update()
    const id = setInterval(update, 10000)
    return () => clearInterval(id)
  }, [ts])
  return label
}

export default function StatusBar({ cursorPos }) {
  const activeTool = useSchematicStore(s => s.activeTool)
  const activeDrawingId = useSchematicStore(s => s.activeDrawingId)
  const drawing = useSchematicStore(s => s.drawings.find(d => d.id === activeDrawingId))
  const selectedIds = useSchematicStore(s => s.selectedIds)
  const currentFilePath = useSchematicStore(s => s.currentFilePath)
  const externalChangeDetected = useSchematicStore(s => s.externalChangeDetected)
  const zoom = drawing?.viewState.zoom || 1
  const isRunning = useSimulationStore(s => s.isRunning)

  const lastSaved = drawing?.lastSaved || null
  const savedLabel = useRelativeTime(lastSaved)

  const componentCount = drawing?.components.length || 0
  const netCount = drawing?.wires.length || 0

  const selComps = selectedIds.length > 0
    ? (drawing?.components || []).filter(c => selectedIds.includes(c.id)).length : 0
  const selWires = selectedIds.length > 0
    ? (drawing?.wires || []).filter(w => selectedIds.includes(w.id)).length : 0
  const selAnns = selectedIds.length > 0
    ? (drawing?.annotations || []).filter(a => selectedIds.includes(a.id)).length : 0

  const selParts = [
    selComps > 0 && `${selComps} comp${selComps > 1 ? 's' : ''}`,
    selWires > 0 && `${selWires} wire${selWires > 1 ? 's' : ''}`,
    selAnns > 0 && `${selAnns} ann${selAnns > 1 ? 's' : ''}`,
  ].filter(Boolean)

  const toolNames = {
    select: 'Select',
    wire: 'Wire',
    text: 'Text',
    callout: 'Callout',
    place: 'Place Component',
  }

  return (
    <div
      className="flex items-center gap-4 px-3 text-xs border-t flex-shrink-0"
      style={{
        height: 24,
        background: 'var(--toolbar-bg)',
        borderColor: 'var(--panel-border)',
        color: '#6b7280',
      }}
    >
      <span>Tool: <span className="text-gray-700 dark:text-gray-300">{toolNames[activeTool] || activeTool}</span></span>
      <span>
        X: <span className="text-gray-700 dark:text-gray-300">{cursorPos?.x ?? 0}</span>
        {' '}Y: <span className="text-gray-700 dark:text-gray-300">{cursorPos?.y ?? 0}</span>
      </span>
      <span>Zoom: <span className="text-gray-700 dark:text-gray-300">{Math.round(zoom * 100)}%</span></span>
      <span>Components: <span className="text-gray-700 dark:text-gray-300">{componentCount}</span></span>
      <span>Nets: <span className="text-gray-700 dark:text-gray-300">{netCount}</span></span>
      {selectedIds.length > 0 && (
        <span>
          Selected: <span className="text-gray-700 dark:text-gray-300">
            {selectedIds.length}{selParts.length > 0 ? ` (${selParts.join(', ')})` : ''}
          </span>
        </span>
      )}
      <span>
        Sim: <span className={isRunning ? 'text-green-500' : 'text-gray-500'}>{isRunning ? 'Running' : 'Stopped'}</span>
      </span>
      {currentFilePath && (
        <span className="ml-auto flex items-center gap-1.5 truncate max-w-xs" title={currentFilePath}>
          {externalChangeDetected && (
            <span className="text-yellow-500" title="File changed externally">⚠</span>
          )}
          <span className="truncate">{basename(currentFilePath)}</span>
          {savedLabel && <span>· {savedLabel}</span>}
        </span>
      )}
    </div>
  )
}
