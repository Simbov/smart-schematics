import React from 'react'
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react'
import useSimulationStore from '../store/simulationStore'
import useSchematicStore from '../store/schematicStore'

export default function SimulationControls() {
  const isRunning = useSimulationStore(s => s.isRunning)
  const speed = useSimulationStore(s => s.speed)
  const play = useSimulationStore(s => s.play)
  const pause = useSimulationStore(s => s.pause)
  const reset = useSimulationStore(s => s.reset)
  const step = useSimulationStore(s => s.step)
  const setSpeed = useSimulationStore(s => s.setSpeed)

  const handleStep = () => {
    const { drawings, activeDrawingId } = useSchematicStore.getState()
    const drawing = drawings.find(d => d.id === activeDrawingId)
    step(drawing?.components, drawing?.wires)
  }

  return (
    <div
      className="flex items-center gap-2 px-3 border-b flex-shrink-0"
      style={{
        height: 36,
        background: 'var(--toolbar-bg)',
        borderColor: 'var(--panel-border)',
      }}
    >
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide mr-1">Sim</span>

      <button
        className={[
          'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
          isRunning
            ? 'bg-yellow-500 text-white hover:bg-yellow-600'
            : 'bg-green-600 text-white hover:bg-green-700',
        ].join(' ')}
        onClick={isRunning ? pause : play}
      >
        {isRunning ? <Pause size={12} /> : <Play size={12} />}
        {isRunning ? 'Pause' : 'Run'}
      </button>

      <button
        className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        onClick={handleStep}
        data-tooltip="Step"
      >
        <SkipForward size={12} />
      </button>

      <button
        className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        onClick={reset}
        data-tooltip="Reset"
      >
        <RotateCcw size={12} />
      </button>

      <div className="flex items-center gap-1.5 ml-2">
        <span className="text-xs text-gray-400">Speed</span>
        <input
          type="range"
          min={0.25}
          max={4}
          step={0.25}
          value={speed}
          onChange={e => setSpeed(parseFloat(e.target.value))}
          className="w-20 h-1 accent-blue-500"
        />
        <span className="text-xs text-gray-400 w-8">{speed}x</span>
      </div>
    </div>
  )
}
