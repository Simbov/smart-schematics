// Electrical simulation engine — state-machine / signal-flow model (not SPICE)

class UnionFind {
  constructor() { this.parent = {}; this.rank = {} }
  find(x) {
    if (!(x in this.parent)) this.parent[x] = x
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x])
    return this.parent[x]
  }
  union(x, y) {
    const px = this.find(x), py = this.find(y)
    if (px === py) return
    const rx = this.rank[px] || 0, ry = this.rank[py] || 0
    if (rx < ry) { this.parent[px] = py }
    else if (rx > ry) { this.parent[py] = px }
    else { this.parent[py] = px; this.rank[px] = rx + 1 }
  }
}

function ptKey(x, y) { return `${Math.round(x)},${Math.round(y)}` }

function buildWireNets(wires) {
  const uf = new UnionFind()
  for (const wire of wires) {
    for (let i = 0; i < wire.points.length - 1; i++) {
      uf.union(
        ptKey(wire.points[i].x, wire.points[i].y),
        ptKey(wire.points[i + 1].x, wire.points[i + 1].y)
      )
    }
  }
  return uf
}

// Returns array of [pinIdA, pinIdB] pairs that are currently conducting
function getSwitchConnections(comp, interactiveStates, relayEnergized) {
  const st = interactiveStates[comp.id]?.state
  const { type, designator } = comp

  switch (type) {
    case 'switch_no':
    case 'limit_switch':
    case 'proximity_switch':
    case 'pressure_switch':
    case 'temperature_switch':
      return st === 'closed' ? [['A', 'B']] : []

    case 'switch_nc':
    case 'circuit_breaker':
      return st === 'open' ? [] : [['A', 'B']]

    case 'switch_spdt': {
      const pos = st || interactiveStates[comp.id]?.position || 'NO'
      return pos === 'NO' ? [['COM', 'NO']] : [['COM', 'NC']]
    }

    case 'pushbutton_no':
      return st === 'pressed' ? [['A', 'B']] : []

    case 'pushbutton_nc':
      return st === 'pressed' ? [] : [['A', 'B']]

    case 'relay_contact_no':
    case 'contactor_no': {
      const on = relayEnergized[designator] ?? false
      return on ? [['C', 'NO']] : []
    }

    case 'relay_contact_nc':
    case 'contactor_nc': {
      const on = relayEnergized[designator] ?? false
      return on ? [] : [['C', 'NC']]
    }

    case 'relay_contact_spdt': {
      const on = relayEnergized[designator] ?? false
      return on ? [['C', 'NO']] : [['C', 'NC']]
    }

    // Diode/zener: passes current A→K only (simplified: always pass both dirs)
    case 'diode':
    case 'zener_diode':
    case 'photodiode':
      return [['A', 'K']]

    // Passive / load devices pass current freely
    case 'resistor':
    case 'variable_resistor':
    case 'potentiometer':
    case 'capacitor':
    case 'electrolytic_capacitor':
    case 'inductor':
    case 'fuse':
    case 'lamp':
    case 'led':
    case 'buzzer':
    case 'speaker':
    case 'motor':
    case 'generator':
    case 'solenoid':
    case 'relay_coil':
    case 'contactor_coil':
    case 'voltmeter':
    case 'ammeter':
    case 'wattmeter':
      return [['A', 'B']]

    // Relay coil specific pin naming
    default:
      return []
  }
}

// Extract the relay key from a designator, e.g. 'K1' from 'K1' or 'KM1'
function relayKey(designator) { return designator }

// Interactive component types that can be clicked/pressed
export const INTERACTIVE_TYPES = new Set([
  'switch_no', 'switch_nc', 'switch_spdt',
  'pushbutton_no', 'pushbutton_nc',
  'limit_switch', 'proximity_switch', 'pressure_switch',
  'temperature_switch', 'circuit_breaker',
  'plc_digital_output', 'plc_pwm_output',
])

export const MOMENTARY_TYPES = new Set(['pushbutton_no', 'pushbutton_nc'])

export const TOGGLE_TYPES = new Set([
  'switch_no', 'switch_nc', 'switch_spdt',
  'limit_switch', 'proximity_switch', 'pressure_switch',
  'temperature_switch', 'circuit_breaker',
  'plc_digital_output', 'plc_pwm_output',
])

// Outputs whose ON state is represented by the 'closed' interactive state.
export const PLC_OUTPUT_TYPES = new Set(['plc_digital_output', 'plc_pwm_output'])
