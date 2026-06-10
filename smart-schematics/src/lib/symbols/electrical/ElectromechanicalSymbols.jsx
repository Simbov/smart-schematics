import React from 'react'

const SW = 1.5

export function RelayCoilSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-15" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <rect x="-15" y="-8" width="30" height="16" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="15" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function RelayContactNOSymbol({ state = {} }) {
  const { closed = false } = state
  const bladeY2 = closed ? 0 : -11
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="-10" cy="0" r="2" fill="currentColor" />
      <circle cx="10" cy="0" r="2" fill="currentColor" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-10" y1="0" x2="8" y2={bladeY2} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="0" y1="-14" x2="0" y2="-20" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
    </g>
  )
}

export function RelayContactNCSymbol({ state = {} }) {
  const { closed = true } = state
  const bladeY2 = closed ? -4 : -11
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="-10" cy="0" r="2" fill="currentColor" />
      <circle cx="10" cy="0" r="2" fill="currentColor" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-10" y1="0" x2="8" y2={bladeY2} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="0" y1="-7" x2="0" y2="-14" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
      <line x1="-2" y1="-16" x2="2" y2="-10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </g>
  )
}

export function RelaySPDTSymbol({ state = {} }) {
  const { position = 'NO' } = state
  const bladeY2 = position === 'NC' ? 8 : -8
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="-10" cy="0" r="2" fill="currentColor" />
      <circle cx="10" cy="-10" r="2" fill="currentColor" />
      <line x1="10" y1="-10" x2="20" y2="-10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="10" cy="10" r="2" fill="currentColor" />
      <line x1="10" y1="10" x2="20" y2="10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-10" y1="0" x2="8" y2={bladeY2} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="0" y1="-10" x2="0" y2="-18" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
    </g>
  )
}

export function ContactorCoilSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-15" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <rect x="-15" y="-8" width="30" height="16" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="-10" y1="-5" x2="10" y2="5" stroke="currentColor" strokeWidth={SW} />
      <line x1="-10" y1="5" x2="10" y2="-5" stroke="currentColor" strokeWidth={SW} />
      <line x1="15" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function ContactorNOSymbol({ state = {} }) {
  const { closed = false } = state
  const bladeY2 = closed ? 0 : -11
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="-10" cy="0" r="2" fill="currentColor" />
      <circle cx="10" cy="0" r="2" fill="currentColor" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-10" y1="0" x2="8" y2={bladeY2} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="0" y1="-14" x2="0" y2="-20" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
    </g>
  )
}

export function ContactorNCSymbol({ state = {} }) {
  const { closed = true } = state
  const bladeY2 = closed ? -4 : -11
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="-10" cy="0" r="2" fill="currentColor" />
      <circle cx="10" cy="0" r="2" fill="currentColor" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-10" y1="0" x2="8" y2={bladeY2} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="0" y1="-7" x2="0" y2="-14" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
      <line x1="-2" y1="-16" x2="2" y2="-10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </g>
  )
}

export function SolenoidSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-15" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <path d="M -15,0 A 4,4 0 0 1 -7,0" stroke="currentColor" strokeWidth={SW} fill="none" />
      <path d="M -7,0 A 4,4 0 0 1 1,0" stroke="currentColor" strokeWidth={SW} fill="none" />
      <path d="M 1,0 A 4,4 0 0 1 9,0" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="9" y1="0" x2="15" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-15" y1="7" x2="15" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="15" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

// Self-contained solenoid-operated relay: coil (A1/A2, left) mechanically linked
// (dashed line) to an SPDT contact (C/NO/NC, right). When energised (state.on,
// driven by the dcSolver coil current) the whole symbol turns amber and the
// blade throws from NC to NO.
export function SolenoidRelaySymbol({ state = {} }) {
  const energised = !!state.on
  const bladeY = energised ? -8 : 8
  return (
    <g style={energised ? { color: 'var(--sim-active-color, #f59e0b)' } : undefined}>
      {/* Coil (left) */}
      <line x1="-32" y1="-12" x2="-24" y2="-12" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-32" y1="12" x2="-24" y2="12" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <rect x="-24" y="-12" width="14" height="24" stroke="currentColor" strokeWidth={SW} fill="none" />
      <text x="-17" y="0" fontSize="9" fill="currentColor" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">K</text>

      {/* Mechanical link (dashed) coil → contact pivot */}
      <line x1="-10" y1="0" x2="0" y2="0" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />

      {/* SPDT contact (right) */}
      <circle cx="0" cy="0" r="2" fill="currentColor" />
      <line x1="0" y1="0" x2="0" y2="24" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />{/* C lead → bottom */}
      <circle cx="18" cy="-8" r="2" fill="currentColor" />
      <line x1="18" y1="-8" x2="32" y2="-8" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />{/* NO */}
      <circle cx="18" cy="8" r="2" fill="currentColor" />
      <line x1="18" y1="8" x2="32" y2="8" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />{/* NC */}
      <line x1="0" y1="0" x2="16" y2={bladeY} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />{/* blade */}
    </g>
  )
}

export function MotorSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-12" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="0" cy="0" r="12" stroke="currentColor" strokeWidth={SW} fill="none" />
      <text x="0" y="0" fontSize="10" fill="currentColor" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">M</text>
      <line x1="12" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function GeneratorSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-12" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="0" cy="0" r="12" stroke="currentColor" strokeWidth={SW} fill="none" />
      <text x="0" y="0" fontSize="10" fill="currentColor" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">G</text>
      <line x1="12" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

// Electronically-driven (proportional) valve: control-electronics block with the
// four standard driver pins on the left (Us supply, Error status, GND, Udc
// command signal) and a solenoid-valve glyph inside. Pin labels stay readable
// when the part is mirrored (inverse-scale wrapper, same trick as PLC I/O).
export function ValveElectronicsSymbol({ state, flipH, flipV }) {
  const labels = [
    { id: 'Us', y: -15 },
    { id: 'Error', y: -5 },
    { id: 'GND', y: 5 },
    { id: 'Udc', y: 15 },
  ]
  const sx = flipH ? -1 : 1
  const sy = flipV ? -1 : 1
  return (
    <g style={state?.on ? { color: 'var(--sim-active-color, #f59e0b)' } : undefined}>
      {/* pin leads into the electronics block */}
      {labels.map(l => (
        <line key={l.id} x1="-30" y1={l.y} x2="-22" y2={l.y}
          stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      ))}
      <rect x="-22" y="-22" width="50" height="44" rx="2"
        stroke="currentColor" strokeWidth={SW} fill="none" />
      {/* pin labels just inside the box edge, kept upright on mirror */}
      {(flipH || flipV) ? (
        <g transform={`scale(${sx}, ${sy})`}>
          {labels.map(l => (
            <text key={l.id} x={(-20) * sx} y={l.y * sy + 2} fontSize="5.5" fill="currentColor"
              textAnchor={flipH ? 'end' : 'start'}>{l.id}</text>
          ))}
        </g>
      ) : (
        labels.map(l => (
          <text key={l.id} x="-20" y={l.y + 2} fontSize="5.5" fill="currentColor" textAnchor="start">{l.id}</text>
        ))
      )}
      {/* solenoid-valve glyph: coil box with diagonal + flow square below */}
      <g transform="translate(11, 0)">
        <rect x="-7" y="-14" width="14" height="9" stroke="currentColor" strokeWidth={1.2} fill="none" />
        <line x1="-7" y1="-5" x2="7" y2="-14" stroke="currentColor" strokeWidth={1.2} />
        <rect x="-7" y="-1" width="14" height="14" stroke="currentColor" strokeWidth={1.2} fill="none" />
        {/* flow arrow through the valve square */}
        <line x1="0" y1="1" x2="0" y2="9" stroke="currentColor" strokeWidth={1.2} />
        <path d="M -2.5,8 L 0,12 L 2.5,8 Z" fill="currentColor" stroke="none" />
        {/* mechanical link coil → valve */}
        <line x1="0" y1="-5" x2="0" y2="-1" stroke="currentColor" strokeWidth={1.2} strokeDasharray="1.5,1.5" />
      </g>
    </g>
  )
}
