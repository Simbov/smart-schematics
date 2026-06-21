import React, { useState } from 'react'
import { RefreshCw, X, CloudOff } from 'lucide-react'
import useSchematicStore from '../store/schematicStore'
import useFileWatcher from '../hooks/useFileWatcher'
import { basename } from '../lib/tauriFs'

// Shown at launch when the last-opened project couldn't be read (commonly an
// OneDrive/Dropbox file that hasn't finished syncing yet). Offers a retry rather
// than silently dropping the user into a blank project with no explanation.
function LoadFailedBanner() {
  const loadFailedPath = useSchematicStore(s => s.loadFailedPath)
  const retryLoadFailed = useSchematicStore(s => s.retryLoadFailed)
  const dismissLoadFailed = useSchematicStore(s => s.dismissLoadFailed)
  const [retrying, setRetrying] = useState(false)

  if (!loadFailedPath) return null
  const fileName = basename(loadFailedPath)

  const retry = async () => {
    setRetrying(true)
    const ok = await retryLoadFailed()
    setRetrying(false)
    if (!ok) {
      alert(`Still couldn't open ${fileName}. It may not have finished syncing yet — try again shortly.`)
    }
  }

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-lg shadow-xl border text-sm"
      style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)', color: 'var(--component-color)' }}
    >
      <CloudOff size={14} className="text-amber-500 flex-shrink-0" />
      <span>
        Couldn't open <strong>{fileName}</strong> — it may still be syncing from the cloud.
      </span>
      <button
        className="px-2.5 py-1 rounded text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
        onClick={retry}
        disabled={retrying}
      >
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
      <button
        className="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        onClick={dismissLoadFailed}
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export default function ExternalChangeBanner() {
  useFileWatcher()

  const externalChangeDetected = useSchematicStore(s => s.externalChangeDetected)
  const currentFilePath = useSchematicStore(s => s.currentFilePath)
  const drawings = useSchematicStore(s => s.drawings)
  const reloadFromCurrentFile = useSchematicStore(s => s.reloadFromCurrentFile)
  const dismissExternalChange = useSchematicStore(s => s.dismissExternalChange)

  if (!externalChangeDetected) return <LoadFailedBanner />

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
