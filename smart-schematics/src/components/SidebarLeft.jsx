import React, { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import FileTree from './FileTree'

// Collapsible left rail that will host the Stage 6 file tree. For Stage 2 it is
// just the chassis: a "Files" header + empty placeholder body, and a collapse
// toggle. Mirrors ComponentLibrary.jsx's collapse pattern (~220px expanded,
// 24px rail when collapsed) but lives on the left, so its border is on the
// right and the chevrons point the opposite way.
export default function SidebarLeft() {
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center py-2 border-r flex-shrink-0"
        style={{
          width: 24,
          background: 'var(--toolbar-bg)',
          borderColor: 'var(--panel-border)',
        }}
      >
        <button
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          onClick={() => setCollapsed(false)}
          title="Show Files"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col border-r flex-shrink-0"
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
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Files</span>
        <button
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          onClick={() => setCollapsed(true)}
          title="Hide Files"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Body — the project file tree (folders, drawings, attachments) */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <FileTree />
      </div>
    </div>
  )
}
