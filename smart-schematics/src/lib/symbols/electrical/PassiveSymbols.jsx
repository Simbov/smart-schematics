import React from 'react'

const SW = 1.5

export function ResistorSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-12" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <rect x="-12" y="-7" width="24" height="14" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="12" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function CapacitorSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-3" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-3" y1="-13" x2="-3" y2="13" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="3" y1="-13" x2="3" y2="13" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="3" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function ElectrolyticCapacitorSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-3" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-3" y1="-13" x2="-3" y2="13" stroke="currentColor" strokeWidth={SW + 0.5} strokeLinecap="round" />
      <path d="M 6,-13 A 21 21 0 0 0 6,13" stroke="currentColor" strokeWidth={SW} fill="none" strokeLinecap="round" />
      <line x1="1.5" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <text x="-10" y="-14" fontSize="9" fill="currentColor" textAnchor="middle" dominantBaseline="auto">+</text>
    </g>
  )
}

export function VariableResistorSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-12" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <rect x="-12" y="-7" width="24" height="14" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="12" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-10" y1="9" x2="10" y2="-9" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <polygon points="10,-9 7.96,-3.8 4.62,-7.52" fill="currentColor" />
    </g>
  )
}

export function PotentiometerSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-12" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <rect x="-12" y="-7" width="24" height="14" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="12" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="0" y1="18" x2="0" y2="3" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <polygon points="0,2 -4,9 4,9" fill="currentColor" />
    </g>
  )
}

export function InductorSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-16" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <path d="M -16,0 A 4,4 0 0 1 -8,0" stroke="currentColor" strokeWidth={SW} fill="none" />
      <path d="M -8,0 A 4,4 0 0 1 0,0" stroke="currentColor" strokeWidth={SW} fill="none" />
      <path d="M 0,0 A 4,4 0 0 1 8,0" stroke="currentColor" strokeWidth={SW} fill="none" />
      <path d="M 8,0 A 4,4 0 0 1 16,0" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="16" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function TransformerSymbol() {
  return (
    <g>
      {/* primary leads */}
      <line x1="-20" y1="-10" x2="-9" y2="-10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-20" y1="10" x2="-9" y2="10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      {/* primary winding: 3 bumps bulging left */}
      <path d="M -9,-10 A 3.3 3.3 0 0 1 -9,-3.3 A 3.3 3.3 0 0 1 -9,3.3 A 3.3 3.3 0 0 1 -9,10"
        stroke="currentColor" strokeWidth={SW} fill="none" />
      {/* iron core */}
      <line x1="-1.5" y1="-12" x2="-1.5" y2="12" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="1.5" y1="-12" x2="1.5" y2="12" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      {/* secondary winding: 3 bumps bulging right */}
      <path d="M 9,-10 A 3.3 3.3 0 0 0 9,-3.3 A 3.3 3.3 0 0 0 9,3.3 A 3.3 3.3 0 0 0 9,10"
        stroke="currentColor" strokeWidth={SW} fill="none" />
      {/* secondary leads */}
      <line x1="20" y1="-10" x2="9" y2="-10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="20" y1="10" x2="9" y2="10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function DiodeSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <polygon points="-10,-10 -10,10 10,0" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="10" y1="-10" x2="10" y2="10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function ZenerDiodeSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <polygon points="-10,-10 -10,10 10,0" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="10" y1="-10" x2="10" y2="10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="10" y1="-10" x2="6" y2="-14" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="10" y1="10" x2="14" y2="14" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function PhotodiodeSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <polygon points="-10,-10 -10,10 10,0" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="10" y1="-10" x2="10" y2="10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <g stroke="currentColor" strokeWidth="1" strokeLinecap="round">
        <line x1="-2" y1="-15" x2="6" y2="-7" />
        <polyline points="3,-7 6,-7 6,-10" fill="none" />
        <line x1="-8" y1="-15" x2="0" y2="-7" />
        <polyline points="-3,-7 0,-7 0,-10" fill="none" />
      </g>
    </g>
  )
}

export function FuseSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-12" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <rect x="-12" y="-7" width="24" height="14" stroke="currentColor" strokeWidth={SW} fill="none" />
      <path d="M -7,5 C -7,-2 0,-2 0,0 C 0,2 7,2 7,-5" stroke="currentColor" strokeWidth={SW} fill="none" strokeLinecap="round" />
      <line x1="12" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}
