import { create } from 'zustand'
import { runDCSimulation } from '../lib/simulation/dcSolver'
import { TOGGLE_TYPES, MOMENTARY_TYPES } from '../lib/simulation/electricalSim'
import { runHydraulicSimulation, defaultDCVPosition, MANUAL_DCV_TYPES } from '../lib/simulation/hydraulicSim'

const useSimulationStore = create((set, get) => ({
  isRunning: false,
  speed: 1,
  tick: 0,
  nets: {},

  // ── Electrical sim state ──────────────────────────────────────────────────
  componentStates: {},
  wireStates: {},
  relayEnergized: {},
  faults: [],
  animationFrame: null,
  interactiveStates: {},  // { [componentId]: { state: string } }

  // ── Hydraulic sim state ───────────────────────────────────────────────────
  // DCV positions manually shifted by the user during simulation.
  // Keyed by componentId; value is position string ('a'|'b'|'center'|'open'|'closed').
  dcvPositions: {},

  // Cylinder extension percentages (0–100), updated each tick by the sim engine.
  // Persisted across ticks so cylinders hold their position when sim is paused.
  cylinderPositions: {},

  // Results from runHydraulicSimulation — parallel to componentStates / wireNetStates
  hydComponentStates: {},
  hydWireNetStates: {},

  play() { set({ isRunning: true }) },
  pause() { set({ isRunning: false }) },

  reset() {
    set({
      isRunning: false,
      tick: 0,
      nets: {},
      componentStates: {},
      wireStates: {},
      relayEnergized: {},
      faults: [],
      interactiveStates: {},
      dcvPositions: {},
      cylinderPositions: {},
      hydComponentStates: {},
      hydWireNetStates: {},
    })
  },

  step(components, wires) {
    const { interactiveStates } = get()
    if (components && wires) {
      try {
        const result = runDCSimulation(components, wires, interactiveStates)
        set({ componentStates: result.componentStates, wireStates: result.wireStates, relayEnergized: result.relayEnergized, tick: get().tick + 1 })
      } catch (e) { console.error('[dcSolver] step error:', e) }
    } else {
      set(state => ({ tick: state.tick + 1 }))
    }
  },

  setSpeed(speed) { set({ speed }) },

  // Run one simulation tick from the current schematic state
  runTick(components, wires) {
    const { interactiveStates } = get()
    try {
      const result = runDCSimulation(components, wires, interactiveStates)
      set({
        componentStates: result.componentStates,
        wireStates: result.wireStates,
        relayEnergized: result.relayEnergized,
        tick: get().tick + 1,
      })
    } catch (e) {
      console.error('[dcSolver] error:', e)
    }
  },

  // Toggle a switch (for switch_no, switch_nc, switch_spdt, etc.)
  // initialPos: the component's configured starting position (simParams.position),
  // used so the first toggle flips relative to the configured state, not a hardcoded default.
  toggleSwitch(componentId, compType, initialPos) {
    set(state => {
      const cur = state.interactiveStates[componentId]?.state
      let next
      if (compType === 'switch_no' || TOGGLE_TYPES.has(compType)) {
        if (compType === 'switch_nc' || compType === 'circuit_breaker') {
          next = cur === 'open' ? undefined : 'open'
        } else if (compType === 'switch_spdt') {
          const effective = cur ?? initialPos ?? 'NO'
          next = effective === 'NC' ? 'NO' : 'NC'
        } else {
          // NO types: default open, toggle to closed
          next = cur === 'closed' ? undefined : 'closed'
        }
      }
      return {
        interactiveStates: {
          ...state.interactiveStates,
          [componentId]: { state: next },
        },
      }
    })
  },

  // Press a momentary button (pushbutton_no / pushbutton_nc)
  pressButton(componentId) {
    set(state => ({
      interactiveStates: {
        ...state.interactiveStates,
        [componentId]: { state: 'pressed' },
      },
    }))
  },

  // Release a momentary button
  releaseButton(componentId) {
    set(state => ({
      interactiveStates: {
        ...state.interactiveStates,
        [componentId]: { state: 'released' },
      },
    }))
  },

  // ── Hydraulic actions ─────────────────────────────────────────────────────

  // Shift a DCV to the next position (cycle: b → a → center → b for 4/3, b → a for 4/2).
  // Called from Canvas when the user clicks a DCV during simulation.
  shiftDCV(compId, compType) {
    set(state => {
      const cur = state.dcvPositions[compId] ?? defaultDCVPosition(compType)
      let next
      if (compType === 'hyd_dcv_4_3_open' || compType === 'hyd_dcv_4_3_closed') {
        next = cur === 'b' ? 'a' : cur === 'a' ? 'center' : 'b'
      } else if (compType === 'hyd_dcv_2_2') {
        next = cur === 'closed' ? 'open' : 'closed'
      } else if (compType === 'hyd_dcv_3_2') {
        next = cur === 'b' ? 'a' : 'b'
      } else {
        // 4/2: two positions
        next = cur === 'b' ? 'a' : 'b'
      }
      return { dcvPositions: { ...state.dcvPositions, [compId]: next } }
    })
  },

  // Run one hydraulic simulation tick. Called from App.jsx RAF loop alongside runTick.
  runHydTick(components, wires) {
    const { dcvPositions, relayEnergized, cylinderPositions, componentStates } = get()
    // Initialise DCV positions for any new DCVs not yet tracked
    const resolvedDCVPositions = { ...dcvPositions }
    components.forEach(c => {
      if (MANUAL_DCV_TYPES.has(c.type) && !(c.id in resolvedDCVPositions)) {
        resolvedDCVPositions[c.id] = defaultDCVPosition(c.type)
      }
    })

    // Phase 12: solenoid → DCV coupling
    // Build solenoidEnergized map from electrical componentStates, then override DCV positions.
    const solenoidEnergized = {}
    components.forEach(c => {
      if (c.type === 'solenoid' && componentStates[c.id]?.on) {
        solenoidEnergized[c.designator] = true
      }
    })
    components.forEach(c => {
      if (!MANUAL_DCV_TYPES.has(c.type)) return
      const linked = c.simParams?.linkedDesignator
      if (c.simParams?.actuation === 'solenoid' && linked) {
        resolvedDCVPositions[c.id] = solenoidEnergized[linked]
          ? 'a'
          : defaultDCVPosition(c.type)
      }
    })
    // cylinderPositions is mutated in place by the engine across ticks
    const cylPos = { ...cylinderPositions }
    try {
      const result = runHydraulicSimulation(components, wires, resolvedDCVPositions, relayEnergized, cylPos)
      set({
        dcvPositions: resolvedDCVPositions,
        cylinderPositions: cylPos,
        hydComponentStates: result.componentStates,
        hydWireNetStates: result.wireNetStates,
        tick: get().tick + 1,
      })
    } catch (e) {
      console.error('[hydraulicSim] error:', e)
    }
  },
}))

export default useSimulationStore
