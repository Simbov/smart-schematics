import React, { useEffect, useState, useRef } from 'react'
import { Sun, Moon, FileText } from 'lucide-react'
import useSchematicStore from '../store/schematicStore'
import useSimulationStore from '../store/simulationStore'
import Toolbar from './Toolbar'
import ComponentLibrary from './ComponentLibrary'
import Canvas from './Canvas'
import PropertiesPanel from './PropertiesPanel'
import DrawingManager from './DrawingManager'
import SimulationControls from './SimulationControls'
import StatusBar from './StatusBar'
import ProjectBrowser from './ProjectBrowser'
import ExternalChangeBanner from './ExternalChangeBanner'
import ErrorBoundary from './ErrorBoundary'
import { setWindowTitle, basename } from '../lib/tauriFs'
import { checkForUpdates } from '../lib/updater'

export default function App() {
  const theme = useSchematicStore(s => s.theme)
  const toggleTheme = useSchematicStore(s => s.toggleTheme)
  const loadFromStorage = useSchematicStore(s => s.loadFromStorage)
  const saveAll = useSchematicStore(s => s.saveAll)
  const saveProjectFile = useSchematicStore(s => s.saveProjectFile)
  const openProjectFile = useSchematicStore(s => s.openProjectFile)
  const newDrawing = useSchematicStore(s => s.newDrawing)
  const showProjectBrowser = useSchematicStore(s => s.showProjectBrowser)
  const setShowProjectBrowser = useSchematicStore(s => s.setShowProjectBrowser)
  const drawings = useSchematicStore(s => s.drawings)
  const currentFilePath = useSchematicStore(s => s.currentFilePath)
  const projects = useSchematicStore(s => s.projects)
  const activeProjectId = useSchematicStore(s => s.activeProjectId)
  const isRunning = useSimulationStore(s => s.isRunning)
  const speed = useSimulationStore(s => s.speed)
  const runTick = useSimulationStore(s => s.runTick)
  const runHydTick = useSimulationStore(s => s.runHydTick)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
  const debounceRef = useRef(null)
  const simRafRef = useRef(null)
  const lastSimTickRef = useRef(0)

  // Bootstrap
  useEffect(() => {
    loadFromStorage()
  }, [])

  // Check for app updates once on startup (no-op outside Tauri)
  useEffect(() => {
    checkForUpdates({ silent: true })
  }, [])

  // Auto-save: 30-second interval + 2-second debounce on any drawing change
  useEffect(() => {
    const interval = setInterval(() => saveAll(), 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const hasDirty = drawings.some(d => d.isDirty)
    if (!hasDirty) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveAll(), 2000)
    return () => clearTimeout(debounceRef.current)
  }, [drawings])

  // Simulation tick loop — runs at ~10Hz * speed when simulation is playing
  useEffect(() => {
    if (!isRunning) {
      cancelAnimationFrame(simRafRef.current)
      return
    }
    const tickInterval = 100 / speed  // ms between ticks

    function loop(ts) {
      if (ts - lastSimTickRef.current >= tickInterval) {
        lastSimTickRef.current = ts
        const { drawings, activeDrawingId } = useSchematicStore.getState()
        const drawing = drawings.find(d => d.id === activeDrawingId)
        if (drawing) {
          runTick(drawing.components, drawing.wires)
          runHydTick(drawing.components, drawing.wires)
        }
      }
      simRafRef.current = requestAnimationFrame(loop)
    }
    simRafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(simRafRef.current)
  }, [isRunning, speed])

  // Also re-run simulation when interactive states change (even while paused)
  const interactiveStates = useSimulationStore(s => s.interactiveStates)
  useEffect(() => {
    const { drawings, activeDrawingId } = useSchematicStore.getState()
    const drawing = drawings.find(d => d.id === activeDrawingId)
    if (drawing) runTick(drawing.components, drawing.wires)
  }, [interactiveStates])

  // Update window title when project/file changes
  useEffect(() => {
    const project = projects.find(p => p.id === activeProjectId)
    const hasDirty = drawings.some(d => d.isDirty)
    const fileName = currentFilePath ? basename(currentFilePath) : project?.name || 'Untitled'
    const dirty = hasDirty ? '• ' : ''
    setWindowTitle(`${dirty}${fileName} — Smart Schematics`)
  }, [currentFilePath, activeProjectId, projects, drawings])

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = e => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') { e.preventDefault(); saveProjectFile() }
        if (e.key === 'n') { e.preventDefault(); newDrawing() }
        if (e.key === 'o') { e.preventDefault(); openProjectFile() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className={theme === 'dark' ? 'dark' : ''}
      style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Top bar */}
      <div
        className="flex items-center px-3 gap-2 flex-shrink-0 border-b"
        style={{
          height: 36,
          background: 'var(--toolbar-bg)',
          borderColor: 'var(--panel-border)',
        }}
      >
        <FileText size={16} className="text-blue-500" />
        <span className="text-sm font-semibold" style={{ color: 'var(--component-color)' }}>
          Smart Schematics
        </span>
        <div className="flex-1" />
        <button
          className="flex items-center justify-center w-7 h-7 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        >
          {theme === 'dark'
            ? <Sun size={14} className="text-yellow-400" />
            : <Moon size={14} className="text-gray-500" />
          }
        </button>
      </div>

      {/* Drawing tabs */}
      <DrawingManager />

      {/* Simulation controls */}
      <ErrorBoundary name="Simulation Controls">
        <SimulationControls />
      </ErrorBoundary>

      {/* Main working area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left toolbar */}
        <Toolbar />

        {/* Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <ErrorBoundary name="Canvas">
            <Canvas onCursorMove={setCursorPos} />
          </ErrorBoundary>
          <PropertiesPanel />
        </div>

        {/* Right component library */}
        <ComponentLibrary />
      </div>

      {/* Status bar */}
      <StatusBar cursorPos={cursorPos} />

      {/* Project browser modal */}
      {showProjectBrowser && (
        <ProjectBrowser onClose={() => setShowProjectBrowser(false)} />
      )}

      {/* External file change banner (OneDrive sync) */}
      <ExternalChangeBanner />
    </div>
  )
}
