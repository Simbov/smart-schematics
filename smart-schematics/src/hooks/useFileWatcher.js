import { useEffect, useRef } from 'react'
import { watchFile, isSelfWriting } from '../lib/tauriFs'
import useSchematicStore from '../store/schematicStore'

// Watches currentFilePath and triggers externalChangeDetected when the file
// is modified by an external process (e.g. OneDrive sync).
export default function useFileWatcher() {
  const currentFilePath = useSchematicStore(s => s.currentFilePath)
  const setExternalChangeDetected = useSchematicStore(s => s.setExternalChangeDetected)
  const unlistenRef = useRef(null)

  useEffect(() => {
    // Clean up previous watcher
    if (unlistenRef.current) {
      unlistenRef.current()
      unlistenRef.current = null
    }

    if (!currentFilePath) return

    let mounted = true

    watchFile(currentFilePath, (_event) => {
      if (!mounted) return
      // Ignore events triggered by our own writes
      if (isSelfWriting()) return
      setExternalChangeDetected(true)
    }).then(unlisten => {
      if (!mounted) {
        unlisten()
      } else {
        unlistenRef.current = unlisten
      }
    }).catch(err => {
      console.warn('File watcher setup failed:', err)
    })

    return () => {
      mounted = false
      if (unlistenRef.current) {
        unlistenRef.current()
        unlistenRef.current = null
      }
    }
  }, [currentFilePath])
}
