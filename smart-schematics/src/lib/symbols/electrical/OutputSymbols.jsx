import React from 'react'

const SW = 1.5

export function LampSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="0" cy="0" r="10" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="-7" y1="-7" x2="7" y2="7" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-7" y1="7" x2="7" y2="-7" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

// Horn / klaxon: driver disc + flaring trumpet, sound arcs in front. When
// powered the arcs pulse outward one after another — the "volume" animates.
export function HornSymbol({ state }) {
  const on = state?.on
  const arcs = [
    { d: 'M 8,-4 A 6,6 0 0 1 8,4', delay: '0s' },
    { d: 'M 11,-6.5 A 9,9 0 0 1 11,6.5', delay: '0.25s' },
    { d: 'M 14,-9 A 12,12 0 0 1 14,9', delay: '0.5s' },
  ]
  return (
    <g>
      <line x1="-20" y1="0" x2="-14" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      {/* driver body */}
      <circle cx="-9" cy="0" r="5" stroke="currentColor" strokeWidth={SW} fill="none" />
      {/* trumpet flare */}
      <path d="M -4,-3 L 5,-9 L 5,9 L -4,3 Z" stroke="currentColor" strokeWidth={SW} fill="none" strokeLinejoin="round" />
      {/* sound arcs — static & faint when off; pulsing when powered */}
      {arcs.map((a, i) => (
        <path key={i} d={a.d} stroke="currentColor" strokeWidth={SW} fill="none" strokeLinecap="round"
          opacity={on ? 1 : 0.45}>
          {on && (
            <animate attributeName="opacity" values="0.15;1;0.15" dur="0.75s"
              begin={a.delay} repeatCount="indefinite" />
          )}
        </path>
      ))}
      <line x1="16" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function BuzzerSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <rect x="-10" y="-10" width="20" height="20" stroke="currentColor" strokeWidth={SW} fill="none" />
      <path d="M 6,-7 A 9,9 0 0 1 6,7" stroke="currentColor" strokeWidth={SW} fill="none" strokeLinecap="round" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function SpeakerSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-12" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <rect x="-12" y="-6" width="8" height="12" stroke="currentColor" strokeWidth={SW} fill="none" />
      <polygon points="-4,-6 10,-14 10,14 -4,6" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function VoltmeterSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-12" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="0" cy="0" r="12" stroke="currentColor" strokeWidth={SW} fill="none" />
      <text x="0" y="0" fontSize="10" fill="currentColor" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">V</text>
      <line x1="12" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function AmmeterSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-12" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="0" cy="0" r="12" stroke="currentColor" strokeWidth={SW} fill="none" />
      <text x="0" y="0" fontSize="10" fill="currentColor" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">A</text>
      <line x1="12" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function WattmeterSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-12" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="0" cy="0" r="12" stroke="currentColor" strokeWidth={SW} fill="none" />
      <text x="0" y="0" fontSize="9" fill="currentColor" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">W</text>
      <line x1="12" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}
