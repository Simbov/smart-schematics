import React from 'react'
import { Loader2, Check, AlertTriangle } from 'lucide-react'
import useSchematicStore from '../store/schematicStore'

// Small bottom-right toast that confirms an export is happening and succeeded —
// exports are otherwise silent (a file just appears in Downloads), which reads as
// "nothing happened". Driven by store.exportStatus; 'rendering' shows a spinner,
// 'done' a green check (auto-dismiss), 'error' a warning.
export default function ExportToast() {
  const status = useSchematicStore(s => s.exportStatus)
  if (!status) return null

  const { phase, label } = status
  const icon =
    phase === 'rendering' ? <Loader2 size={15} className="text-blue-500 animate-spin" />
    : phase === 'done' ? <Check size={15} className="text-green-500" />
    : <AlertTriangle size={15} className="text-amber-500" />

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg shadow-xl border text-sm transition-opacity"
      style={{
        background: 'var(--panel-bg)',
        borderColor: 'var(--panel-border)',
        color: 'var(--component-color)',
        minWidth: 180,
      }}
      role="status"
      aria-live="polite"
    >
      <span className="flex-shrink-0">{icon}</span>
      <span>{label || (phase === 'rendering' ? 'Exporting…' : phase === 'done' ? 'Export complete' : 'Export failed')}</span>
    </div>
  )
}
