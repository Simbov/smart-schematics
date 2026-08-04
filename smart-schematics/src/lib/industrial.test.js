import { describe, it, expect } from 'vitest'
import {
  terminalStripGeom, terminalStripPins, terminalStripSize, terminalStripDrawing,
  harnessConnectorPins, harnessConnectorSize, harnessConnectorDrawing,
  safetyRelayGeom, safetyRelayPins, safetyRelaySize, safetyRelayDrawing,
  safetyContactNumbers, auxContactNumbers,
  safetyIoPins, safetyIoSize, safetyIoDrawing, parseSignals,
  selectorGeom, selectorPins, selectorSize, selectorDrawing, parseClosedPairs,
  indicatorLens,
  TERMINAL_MAX_WAYS, CONNECTOR_MAX_WAYS, IO_MAX_CHANNELS,
  SELECTOR_MAX_PAIRS,
} from './industrial'

// Pin ids must be unique within a component — a duplicate id makes wire
// re-attachment ambiguous and lets one wire silently hijack another's terminal.
function expectUniqueIds(pins) {
  const ids = pins.map(p => p.id)
  expect(new Set(ids).size).toBe(ids.length)
}

// Every pin has to sit inside the footprint the def reports, or wires will
// attach outside the selection box and the part will export cropped.
function expectPinsWithinSize(pins, size) {
  for (const p of pins) {
    expect(Math.abs(p.relX)).toBeLessThanOrEqual(size.width / 2 + 0.001)
    expect(Math.abs(p.relY)).toBeLessThanOrEqual(size.height / 2 + 0.001)
  }
}

describe('terminal strip', () => {
  it('gives every way an internal and a field terminal', () => {
    const pins = terminalStripPins({ ways: 4 })
    expect(pins).toHaveLength(8)
    expect(pins.filter(p => p.direction === 'N')).toHaveLength(4)
    expect(pins.filter(p => p.direction === 'S')).toHaveLength(4)
    expectUniqueIds(pins)
  })

  it('pairs each way on a single centre line', () => {
    const pins = terminalStripPins({ ways: 3 })
    for (let i = 1; i <= 3; i++) {
      const top = pins.find(p => p.id === `T${i}`)
      const bottom = pins.find(p => p.id === `B${i}`)
      expect(top.relX).toBe(bottom.relX)
      expect(top.relY).toBe(-bottom.relY)
    }
  })

  it('keeps pin ids positional so renumbering never detaches a wire', () => {
    const before = terminalStripPins({ ways: 4, startNumber: 1 })
    const after = terminalStripPins({ ways: 4, startNumber: 19 })
    expect(after.map(p => p.id)).toEqual(before.map(p => p.id))
    expect(after.find(p => p.id === 'T1').label).toBe('19')
    expect(after.find(p => p.id === 'T4').label).toBe('22')
  })

  it('lands every terminal on the 10-unit grid', () => {
    for (const ways of [1, 2, 5, 6, 13, 40]) {
      for (const p of terminalStripPins({ ways })) {
        expect(Math.abs(p.relX) % 10).toBe(0)
        expect(Math.abs(p.relY) % 10).toBe(0)
      }
    }
  })

  it('grows only in width', () => {
    const a = terminalStripSize({ ways: 2 })
    const b = terminalStripSize({ ways: 20 })
    expect(b.width).toBe(a.width * 10)
    expect(b.height).toBe(a.height)
  })

  it('clamps a nonsense way count instead of producing a degenerate part', () => {
    expect(terminalStripGeom({ ways: 0 }).ways).toBe(1)
    expect(terminalStripGeom({ ways: 500 }).ways).toBe(TERMINAL_MAX_WAYS)
    expect(terminalStripGeom({ ways: 'six' }).ways).toBe(6)
    expect(terminalStripGeom({}).ways).toBe(6)
  })

  it('omits the separator after the last cell', () => {
    const cells = terminalStripDrawing({ ways: 3 }).cells
    expect(cells.slice(0, -1).every(c => c.separatorX != null)).toBe(true)
    expect(cells[cells.length - 1].separatorX).toBeNull()
  })

  it('keeps pins inside the reported footprint', () => {
    for (const ways of [1, 6, 40]) {
      expectPinsWithinSize(terminalStripPins({ ways }), terminalStripSize({ ways }))
    }
  })
})

describe('harness connector', () => {
  it('gives one contact per way, all on the mating side', () => {
    const pins = harnessConnectorPins({ ways: 8 })
    expect(pins).toHaveLength(8)
    expect(pins.every(p => p.direction === 'E')).toBe(true)
    expectUniqueIds(pins)
  })

  it('numbers contacts from startNumber without changing pin ids', () => {
    const pins = harnessConnectorPins({ ways: 3, startNumber: 10 })
    expect(pins.map(p => p.id)).toEqual(['P1', 'P2', 'P3'])
    expect(pins.map(p => p.label)).toEqual(['10', '11', '12'])
  })

  it('grows only in height', () => {
    const a = harnessConnectorSize({ ways: 2 })
    const b = harnessConnectorSize({ ways: 12 })
    expect(b.width).toBe(a.width)
    expect(b.height).toBe(a.height * 6)
  })

  it('clamps the way count', () => {
    expect(harnessConnectorPins({ ways: 0 })).toHaveLength(1)
    expect(harnessConnectorPins({ ways: 999 })).toHaveLength(CONNECTOR_MAX_WAYS)
  })

  it('falls back to a socket for an unknown gender', () => {
    expect(harnessConnectorDrawing({ gender: 'Banana' }).gender).toBe('Socket')
    expect(harnessConnectorDrawing({ gender: 'Pin' }).gender).toBe('Pin')
  })

  it('keeps pins inside the reported footprint', () => {
    for (const ways of [1, 6, 40]) {
      expectPinsWithinSize(harnessConnectorPins({ ways }), harnessConnectorSize({ ways }))
    }
  })
})

describe('safety relay', () => {
  it('numbers NO safety contacts and NC auxiliaries per IEC 60947', () => {
    expect(safetyContactNumbers(0)).toEqual({ top: '13', bottom: '14' })
    expect(safetyContactNumbers(2)).toEqual({ top: '33', bottom: '34' })
    // With three NO contacts, the first auxiliary continues the run at 41/42.
    expect(auxContactNumbers(0, 3)).toEqual({ top: '41', bottom: '42' })
    expect(auxContactNumbers(1, 3)).toEqual({ top: '51', bottom: '52' })
  })

  it('exposes the full default terminal set', () => {
    const ids = safetyRelayPins({}).map(p => p.id)
    expect(ids).toEqual(expect.arrayContaining([
      'A1', 'A2', 'X1', 'X4', 'T1', 'R1', 'T2', 'R2',
      '13', '14', '23', '24', '33', '34', '41', '42',
    ]))
    expect(ids).toHaveLength(16)
    expectUniqueIds(safetyRelayPins({}))
  })

  it('pairs each output contact on one column', () => {
    const pins = safetyRelayPins({})
    for (const [a, b] of [['13', '14'], ['23', '24'], ['33', '34'], ['41', '42']]) {
      const top = pins.find(p => p.id === a)
      const bottom = pins.find(p => p.id === b)
      expect(top.relX).toBe(bottom.relX)
      expect(top.relY).toBeLessThan(0)
      expect(bottom.relY).toBeGreaterThan(0)
    }
  })

  it('drops the second channel when configured single-channel', () => {
    const ids = safetyRelayPins({ channels: 1 }).map(p => p.id)
    expect(ids).toContain('T1')
    expect(ids).not.toContain('T2')
    expect(ids).not.toContain('R2')
  })

  it('supports an all-NO relay with no auxiliaries', () => {
    const d = safetyRelayDrawing({ contacts: 4, auxContacts: 0 })
    expect(d.outputs).toHaveLength(4)
    expect(d.outputs.every(o => o.kind === 'NO')).toBe(true)
  })

  it('marks auxiliaries NC and safety contacts NO', () => {
    const d = safetyRelayDrawing({ contacts: 2, auxContacts: 2 })
    expect(d.outputs.map(o => o.kind)).toEqual(['NO', 'NO', 'NC', 'NC'])
    expect(d.outputs.map(o => o.top)).toEqual(['13', '23', '31', '41'])
  })

  it('widens with every added contact and stays the same height', () => {
    const small = safetyRelaySize({ contacts: 1, auxContacts: 0, channels: 1 })
    const large = safetyRelaySize({ contacts: 4, auxContacts: 2, channels: 2 })
    expect(large.width).toBeGreaterThan(small.width)
    expect(large.height).toBe(small.height)
  })

  it('clamps counts out of range', () => {
    expect(safetyRelayGeom({ contacts: 99, auxContacts: 9, channels: 7 }))
      .toMatchObject({ contacts: 4, aux: 2, channels: 2 })
    expect(safetyRelayGeom({ contacts: 0 }).contacts).toBe(1)
    expect(safetyRelayGeom({ auxContacts: 0 }).aux).toBe(0)
  })

  it('carries two redundant contacts per output, on two armature bars', () => {
    // A dual-channel safety relay puts one contact per internal relay in series
    // on every output; both hang off armature bars that span the whole section.
    const d = safetyRelayDrawing({})
    expect(d.armatures).toHaveLength(2)
    expect(d.contact.fixed1).toBeLessThan(d.contact.pivot1)
    expect(d.contact.pivot1).toBeLessThan(d.contact.fixed2)
    expect(d.contact.fixed2).toBeLessThan(d.contact.pivot2)
    // Each bar sits between its own contact's fixed and moving halves.
    expect(d.armatures[0].y).toBeGreaterThan(d.contact.fixed1)
    expect(d.armatures[0].y).toBeLessThan(d.contact.pivot1)
    expect(d.armatures[1].y).toBeGreaterThan(d.contact.fixed2)
    expect(d.armatures[1].y).toBeLessThan(d.contact.pivot2)
  })

  it('spans the armature bars past the outermost contacts', () => {
    const d = safetyRelayDrawing({ contacts: 3, auxContacts: 1 })
    const first = d.outputs[0].x, last = d.outputs[d.outputs.length - 1].x
    for (const a of d.armatures) {
      expect(a.from).toBeLessThan(first)
      expect(a.to).toBeGreaterThan(last)
    }
  })

  it('keeps the whole contact stack inside the housing', () => {
    const d = safetyRelayDrawing({})
    for (const y of Object.values(d.contact)) {
      expect(Math.abs(y)).toBeLessThan(d.half)
    }
  })

  it('crosses the mode legend cell that is selected', () => {
    expect(safetyRelayDrawing({ mode: 'Manual' }).modeSelect.active).toBe('M')
    expect(safetyRelayDrawing({ mode: 'Auto' }).modeSelect.active).toBe('A')
    expect(safetyRelayDrawing({}).modeSelect.active).toBe('M')
  })

  it('lists one status lamp per channel plus MODE', () => {
    expect(safetyRelayDrawing({ channels: 2 }).indicators).toEqual(['CH1', 'MODE', 'CH2'])
    expect(safetyRelayDrawing({ channels: 1 }).indicators).toEqual(['CH1', 'MODE'])
  })

  it('keeps pins inside the reported footprint', () => {
    for (const p of [{}, { contacts: 4, auxContacts: 2 }, { channels: 1, contacts: 1, auxContacts: 0 }]) {
      expectPinsWithinSize(safetyRelayPins(p), safetyRelaySize(p))
    }
  })
})

describe('safety I/O group', () => {
  it('gives one field terminal per channel', () => {
    const pins = safetyIoPins({ channels: 8 })
    expect(pins).toHaveLength(8)
    expect(pins.every(p => p.direction === 'S')).toBe(true)
    expectUniqueIds(pins)
  })

  it('numbers terminals from startNumber', () => {
    const pins = safetyIoPins({ channels: 6, startNumber: 19 })
    expect(pins.map(p => p.label)).toEqual(['19', '20', '21', '22', '23', '24'])
    expect(pins.map(p => p.id)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6'])
  })

  it('pads and truncates the signal list rather than shifting terminals', () => {
    expect(parseSignals('L-,1,2', 5)).toEqual(['L-', '1', '2', '', ''])
    expect(parseSignals('a,b,c,d', 2)).toEqual(['a', 'b'])
    expect(parseSignals(undefined, 3)).toEqual(['', '', ''])
    expect(parseSignals(' L- , 1 ', 2)).toEqual(['L-', '1'])
  })

  it('falls back to DI for an unknown group', () => {
    expect(safetyIoDrawing({ group: 'ZZ' }).group).toBe('DI')
    expect(safetyIoDrawing({ group: 'TO' }).group).toBe('TO')
  })

  it('clamps the channel count', () => {
    expect(safetyIoPins({ channels: 0 })).toHaveLength(1)
    expect(safetyIoPins({ channels: 99 })).toHaveLength(IO_MAX_CHANNELS)
  })

  it('puts the screw terminal nearest the side the conductor leaves from', () => {
    // Leads down: rings at the bottom of the group, signals furthest in.
    const down = safetyIoDrawing({ channels: 4, leads: 'Down' })
    expect(down.rows.signal).toBeLessThan(down.rows.number)
    expect(down.rows.number).toBeLessThan(down.rows.ring)
    // Leads up: the whole stack flips.
    const up = safetyIoDrawing({ channels: 4, leads: 'Up' })
    expect(up.rows.ring).toBeLessThan(up.rows.number)
    expect(up.rows.number).toBeLessThan(up.rows.signal)
  })

  it('keeps every row inside the group and the lead outside it', () => {
    for (const leads of ['Down', 'Up']) {
      const d = safetyIoDrawing({ channels: 4, leads })
      for (const y of Object.values(d.rows)) {
        expect(y, `${leads} row`).toBeGreaterThan(d.top)
        expect(y, `${leads} row`).toBeLessThan(d.top + d.bodyH)
      }
      // The conductor runs from the group edge outward, never across a label.
      expect(Math.abs(d.leadTo - d.leadFrom)).toBe(d.lead)
      for (const y of Object.values(d.rows)) {
        expect(Math.min(d.leadFrom, d.leadTo) <= y && y <= Math.max(d.leadFrom, d.leadTo)).toBe(false)
      }
    }
  })

  it('sends the pins the way the conductors leave', () => {
    expect(safetyIoPins({ channels: 3, leads: 'Up' }).every(p => p.direction === 'N')).toBe(true)
    expect(safetyIoPins({ channels: 3, leads: 'Down' }).every(p => p.direction === 'S')).toBe(true)
    // Flipping the direction must not disturb the pin ids, or every bound wire
    // would come adrift.
    expect(safetyIoPins({ channels: 3, leads: 'Up' }).map(p => p.id))
      .toEqual(safetyIoPins({ channels: 3, leads: 'Down' }).map(p => p.id))
  })

  it('keeps pins inside the reported footprint', () => {
    for (const channels of [1, 6, 16]) {
      expectPinsWithinSize(safetyIoPins({ channels }), safetyIoSize({ channels }))
    }
  })
})

describe('selector switch', () => {
  it('gives every contact pair its own two terminals', () => {
    const pins = selectorPins({ pairs: 8 })
    expect(pins).toHaveLength(16)
    expect(pins.every(p => p.direction === 'S')).toBe(true)
    expectUniqueIds(pins)
  })

  it('numbers terminals straight through, so pair n is (2n-1)-(2n)', () => {
    const d = selectorDrawing({ pairs: 4 })
    expect(d.contacts.map(c => c.label)).toEqual(['1-2', '3-4', '5-6', '7-8'])
  })

  it('renumbers from startNumber without changing pin ids', () => {
    const a = selectorPins({ pairs: 3, startNumber: 1 })
    const b = selectorPins({ pairs: 3, startNumber: 9 })
    expect(b.map(p => p.id)).toEqual(a.map(p => p.id))
    expect(b.map(p => p.label)).toEqual(['9', '10', '11', '12', '13', '14'])
  })

  it('closes exactly the pairs named by the truth-table row', () => {
    const d = selectorDrawing({ pairs: 8, closed: '1,2,5' })
    expect(d.contacts.filter(c => c.made).map(c => c.label)).toEqual(['1-2', '3-4', '9-10'])
  })

  it('ignores junk and out-of-range entries in the made list', () => {
    expect(parseClosedPairs('1, 99, x, -3, 4', 8)).toEqual(new Set([1, 4]))
    expect(parseClosedPairs('', 8)).toEqual(new Set())
    expect(parseClosedPairs(undefined, 8)).toEqual(new Set())
  })

  it('leaves every contact open when no row is given', () => {
    expect(selectorDrawing({ pairs: 6 }).contacts.some(c => c.made)).toBe(false)
  })

  it('keeps a pair legs symmetric about its own centre line', () => {
    const d = selectorDrawing({ pairs: 3 })
    for (const c of d.contacts) {
      expect(c.right - c.x).toBe(c.x - c.left)
    }
  })

  it('clamps the pair count', () => {
    expect(selectorGeom({ pairs: 0 }).pairs).toBe(1)
    expect(selectorGeom({ pairs: 99 }).pairs).toBe(SELECTOR_MAX_PAIRS)
    expect(selectorGeom({}).pairs).toBe(8)
  })

  it('only draws the shaft when there is more than one contact to gang', () => {
    expect(selectorDrawing({ pairs: 1 }).gang).toBeNull()
    expect(selectorDrawing({ pairs: 2 }).gang).not.toBeNull()
  })

  it('keeps pins inside the reported footprint', () => {
    for (const p of [{}, { pairs: 12 }, { pairs: 1 }]) {
      expectPinsWithinSize(selectorPins(p), selectorSize(p))
    }
  })
})

describe('panel indicator', () => {
  it('resolves a lens colour, defaulting to red', () => {
    expect(indicatorLens('Green')).toBe('#16a34a')
    expect(indicatorLens('Nonsense')).toBe(indicatorLens('Red'))
    expect(indicatorLens(undefined)).toBe(indicatorLens('Red'))
  })
})
