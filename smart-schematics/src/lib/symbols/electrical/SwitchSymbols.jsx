import React from 'react'

const SW = 1.5

export function SwitchNOSymbol({ state = {} }) {
  const { closed = false } = state
  const bladeY2 = closed ? 0 : -11
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="-10" cy="0" r="2" fill="currentColor" />
      <circle cx="10" cy="0" r="2" fill="currentColor" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-10" y1="0" x2={closed ? 10 : 8} y2={bladeY2} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function SwitchNCSymbol({ state = {} }) {
  const { closed = true } = state
  const bladeY2 = closed ? -5 : -11
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="-10" cy="0" r="2" fill="currentColor" />
      <circle cx="10" cy="0" r="2" fill="currentColor" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-10" y1="0" x2="8" y2={bladeY2} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-2" y1="-10" x2="2" y2="-3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </g>
  )
}

export function SwitchSPDTSymbol({ state = {} }) {
  const { position = 'NO' } = state
  // Blade pivots at the common contact (-10,0) and its tip lands exactly on the
  // selected throw contact dot at (10,-10) [NO] or (10,10) [NC].
  const bladeX2 = 10
  const bladeY2 = position === 'NC' ? 10 : -10
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="-10" cy="0" r="2" fill="currentColor" />
      <circle cx="10" cy="-10" r="2" fill="currentColor" />
      <line x1="10" y1="-10" x2="20" y2="-10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="10" cy="10" r="2" fill="currentColor" />
      <line x1="10" y1="10" x2="20" y2="10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-10" y1="0" x2={bladeX2} y2={bladeY2} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function PushButtonNOSymbol({ state = {} }) {
  const { pressed = false } = state
  const bladeY2 = pressed ? 0 : -11
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="-10" cy="0" r="2" fill="currentColor" />
      <circle cx="10" cy="0" r="2" fill="currentColor" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-10" y1="0" x2="8" y2={bladeY2} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="0" y1="-11" x2="0" y2="-18" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-8" y1="-18" x2="8" y2="-18" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function PushButtonNCSymbol({ state = {} }) {
  const { pressed = false } = state
  const bladeY2 = pressed ? -11 : -3
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="-10" cy="0" r="2" fill="currentColor" />
      <circle cx="10" cy="0" r="2" fill="currentColor" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-10" y1="0" x2="8" y2={bladeY2} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="0" y1="-3" x2="0" y2="-10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-8" y1="-10" x2="8" y2="-10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-2" y1="-14" x2="2" y2="-7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </g>
  )
}

export function LimitSwitchSymbol({ state = {} }) {
  const { closed = false } = state
  const bladeY2 = closed ? 0 : -11
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="-10" cy="0" r="2" fill="currentColor" />
      <circle cx="10" cy="0" r="2" fill="currentColor" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-10" y1="0" x2={closed ? 10 : 8} y2={bladeY2} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="0" y1="-11" x2="0" y2="-17" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="0" cy="-20" r="3" stroke="currentColor" strokeWidth={SW} fill="none" />
    </g>
  )
}

export function ProximitySwitchSymbol({ state = {} }) {
  const { closed = false } = state
  const bladeY2 = closed ? 0 : -11
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="-10" cy="0" r="2" fill="currentColor" />
      <circle cx="10" cy="0" r="2" fill="currentColor" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-10" y1="0" x2={closed ? 10 : 8} y2={bladeY2} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <path d="M -4,-17 A 6,6 0 0 1 4,-17" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M -8,-20 A 10,10 0 0 1 8,-20" stroke="currentColor" strokeWidth="1" fill="none" />
    </g>
  )
}

export function PressureSwitchSymbol({ state = {} }) {
  const { closed = false } = state
  const bladeY2 = closed ? 0 : -11
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="-10" cy="0" r="2" fill="currentColor" />
      <circle cx="10" cy="0" r="2" fill="currentColor" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-10" y1="0" x2={closed ? 10 : 8} y2={bladeY2} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <polygon points="0,-12 4,-16 0,-20 -4,-16" stroke="currentColor" strokeWidth="1" fill="none" />
    </g>
  )
}

export function TemperatureSwitchSymbol({ state = {} }) {
  const { closed = false } = state
  const bladeY2 = closed ? 0 : -11
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="-10" cy="0" r="2" fill="currentColor" />
      <circle cx="10" cy="0" r="2" fill="currentColor" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-10" y1="0" x2={closed ? 10 : 8} y2={bladeY2} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="0" cy="-17" r="5" stroke="currentColor" strokeWidth="1" fill="none" />
      <line x1="-5" y1="-17" x2="5" y2="-17" stroke="currentColor" strokeWidth="1" />
    </g>
  )
}

export function CircuitBreakerSymbol({ state = {} }) {
  const { closed = false } = state
  const bladeY2 = closed ? 0 : -11
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="-10" cy="0" r="2" fill="currentColor" />
      <circle cx="10" cy="0" r="2" fill="currentColor" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-10" y1="0" x2={closed ? 10 : 8} y2={bladeY2} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <rect x="-3" y="-17" width="6" height="6" stroke="currentColor" strokeWidth="1" fill="none" />
    </g>
  )
}
