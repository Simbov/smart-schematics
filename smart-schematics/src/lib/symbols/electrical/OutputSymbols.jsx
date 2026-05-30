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
