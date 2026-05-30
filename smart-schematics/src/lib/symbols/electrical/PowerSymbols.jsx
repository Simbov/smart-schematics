import React from 'react'

const SW = 1.5

export function BatterySymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-9" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-9" y1="-13" x2="-9" y2="13" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-4" y1="-7" x2="-4" y2="7" stroke="currentColor" strokeWidth={SW + 0.5} strokeLinecap="round" />
      <line x1="4" y1="-13" x2="4" y2="13" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="9" y1="-7" x2="9" y2="7" stroke="currentColor" strokeWidth={SW + 0.5} strokeLinecap="round" />
      <line x1="9" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <text x="-16" y="-14" fontSize="8" fill="currentColor" textAnchor="middle" dominantBaseline="auto">−</text>
      <text x="16" y="-14" fontSize="8" fill="currentColor" textAnchor="middle" dominantBaseline="auto">+</text>
    </g>
  )
}

export function GroundSymbol() {
  return (
    <g>
      <line x1="0" y1="0" x2="0" y2="8" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-14" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-9" y1="13" x2="9" y2="13" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-4" y1="18" x2="4" y2="18" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function DCCurrentSourceSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-12" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="0" cy="0" r="12" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="-6" y1="0" x2="4" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <polygon points="4,-4 4,4 10,0" fill="currentColor" />
      <line x1="12" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function ACVoltageSourceSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-12" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="0" cy="0" r="12" stroke="currentColor" strokeWidth={SW} fill="none" />
      <path d="M -7,0 C -5,-8 -1,-8 0,0 C 1,8 5,8 7,0" stroke="currentColor" strokeWidth={SW} fill="none" strokeLinecap="round" />
      <line x1="12" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function VCCRailSymbol() {
  return (
    <g>
      <line x1="0" y1="0" x2="0" y2="-12" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-12" y1="-12" x2="12" y2="-12" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <text x="0" y="-16" fontSize="8" fill="currentColor" textAnchor="middle" dominantBaseline="auto">VCC</text>
    </g>
  )
}

export function VSSRailSymbol() {
  return (
    <g>
      <line x1="0" y1="0" x2="0" y2="12" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-12" y1="12" x2="12" y2="12" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <text x="0" y="22" fontSize="8" fill="currentColor" textAnchor="middle" dominantBaseline="auto">VSS</text>
    </g>
  )
}
