import React from 'react'
import { RefreshCw, X } from 'lucide-react'
import useSchematicStore from '../store/schematicStore'
import useFileWatcher from '../hooks/useFileWatcher'
import { basename } from '../lib/tauriFs'

export default function ExternalChangeBanner() {
  useFileWatcher()

  const externalChangeDetected = useSchematicStore(s => s.externalChangeDetected)
  const currentFilePath = useSchematicStore(s => s.currentFilePath)
  const drawings = useSchematicStore(s => s.drawings)
  const reloadFromCurrentFile = useSchematicStore(s => s.reloadFromCurrentFile)
  const dismissExternalChange = useSchematicStore(s => s.dismissExternalChange)

  if (!externalChangeDetected) return null

  const hasDirty = drawings.some(d => d.isDirty)
  const fileName = currentFilePath ? basename(currentFilePath) : 'this file'

  return (
    <div
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-lg shadow-xl border text-sm"
      style={{
        background: 'var(--panel-bg)',
        borderColor: 'var(--panel-border)',
        color: 'var(--component-color)',
      }}
    >
      <RefreshCw size={14} className="text-blue-500 flex-shrink-0" />
      <span>
        <strong>{fileName}</strong> was updated externally
        {hasDirty ? ' — you have unsaved changes.' : '.'}
      </span>
      <button
        className="px-2.5 py-1 rounded text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
        onClick={reloadFromCurrentFile}
      >
        Reload
      </button>
      <button
        className="px-2.5 py-1 rounded text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        onClick={dismissExternalChange}
        title="Keep my version"
      >
        Keep mine
      </button>
      <button
        className="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        onClick={dismissExternalChange}
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}
