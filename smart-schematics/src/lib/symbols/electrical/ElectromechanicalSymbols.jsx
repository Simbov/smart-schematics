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
