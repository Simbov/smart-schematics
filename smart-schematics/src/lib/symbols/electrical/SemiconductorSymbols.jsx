import React from 'react'

const SW = 1.5

export function LEDSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <polygon points="-10,-10 -10,10 10,0" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="10" y1="-10" x2="10" y2="10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <g stroke="currentColor" strokeWidth="1" strokeLinecap="round">
        <line x1="2" y1="-5" x2="10" y2="-14" />
        <polyline points="7,-13 10,-14 9,-11" fill="none" />
        <line x1="6" y1="-2" x2="14" y2="-11" />
        <polyline points="11,-10 14,-11 13,-8" fill="none" />
      </g>
    </g>
  )
}

export function NPNTransistorSymbol() {
  return (
    <g>
      <circle cx="0" cy="0" r="14" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="-20" y1="0" x2="-5" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-5" y1="-9" x2="-5" y2="9" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-5" y1="-4" x2="10" y2="-20" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-5" y1="4" x2="10" y2="20" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      {/* emitter arrow points outward (away from base) */}
      <polygon points="7.75,17.6 1.46,15.27 5.84,11.17" fill="currentColor" />
    </g>
  )
}

export function PNPTransistorSymbol() {
  return (
    <g>
      <circle cx="0" cy="0" r="14" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="-20" y1="0" x2="-5" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-5" y1="-9" x2="-5" y2="9" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-5" y1="-4" x2="10" y2="-20" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-5" y1="4" x2="10" y2="20" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      {/* emitter arrow points inward (toward base) */}
      <polygon points="0.25,9.6 2.16,16.03 6.54,11.93" fill="currentColor" />
    </g>
  )
}

export function NMOSSymbol() {
  return (
    <g>
      <line x1="-20" y1="-10" x2="-8" y2="-10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-8" y1="-16" x2="-8" y2="16" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-4" y1="-14" x2="-4" y2="-6" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-4" y1="-3" x2="-4" y2="3" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeDasharray="2,1" />
      <line x1="-4" y1="6" x2="-4" y2="14" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-4" y1="-10" x2="10" y2="-10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="10" y1="-10" x2="10" y2="-20" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-4" y1="10" x2="10" y2="10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="10" y1="10" x2="10" y2="20" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <polygon points="-4,0 2,-3 2,3" fill="currentColor" />
    </g>
  )
}

export function PMOSSymbol() {
  return (
    <g>
      <line x1="-20" y1="-10" x2="-11" y2="-10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <circle cx="-9" cy="-10" r="2" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="-7" y1="-16" x2="-7" y2="16" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-3" y1="-14" x2="-3" y2="-6" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-3" y1="-3" x2="-3" y2="3" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeDasharray="2,1" />
      <line x1="-3" y1="6" x2="-3" y2="14" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-3" y1="-10" x2="10" y2="-10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="10" y1="-10" x2="10" y2="-20" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-3" y1="10" x2="10" y2="10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="10" y1="10" x2="10" y2="20" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <polygon points="-3,0 -9,-3 -9,3" fill="currentColor" />
    </g>
  )
}

export function NJFETSymbol() {
  return (
    <g>
      <line x1="-20" y1="-10" x2="-4" y2="-10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-4" y1="-16" x2="-4" y2="16" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-4" y1="-10" x2="10" y2="-10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="10" y1="-10" x2="10" y2="-20" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-4" y1="10" x2="10" y2="10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="10" y1="10" x2="10" y2="20" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <polygon points="-4,-10 -10,-7 -10,-13" fill="currentColor" />
    </g>
  )
}

export function SCRSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <polygon points="-10,-10 -10,10 10,0" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="10" y1="-10" x2="10" y2="10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      {/* gate lead off the cathode bar */}
      <line x1="10" y1="10" x2="10" y2="20" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function TRIACSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <polygon points="-10,-8 -10,8 10,0" stroke="currentColor" strokeWidth={SW} fill="none" />
      <polygon points="10,-8 10,8 -10,0" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="-10" y1="-10" x2="-10" y2="10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="10" y1="-10" x2="10" y2="10" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="0" y1="0" x2="0" y2="20" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}

export function OpAmpSymbol() {
  return (
    <g>
      <polygon points="-14,-16 -14,16 14,0" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="-20" y1="-8" x2="-14" y2="-8" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-20" y1="8" x2="-14" y2="8" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="14" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <text x="-11" y="-8" fontSize="7" fill="currentColor" textAnchor="middle" dominantBaseline="middle">−</text>
      <text x="-11" y="8" fontSize="7" fill="currentColor" textAnchor="middle" dominantBaseline="middle">+</text>
    </g>
  )
}

export function ComparatorSymbol() {
  return (
    <g>
      <polygon points="-14,-16 -14,16 14,0" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="-20" y1="-8" x2="-14" y2="-8" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-20" y1="8" x2="-14" y2="8" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="14" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <text x="-11" y="-8" fontSize="7" fill="currentColor" textAnchor="middle" dominantBaseline="middle">−</text>
      <text x="-11" y="8" fontSize="7" fill="currentColor" textAnchor="middle" dominantBaseline="middle">+</text>
      <circle cx="17" cy="0" r="3" stroke="currentColor" strokeWidth="1" fill="none" />
    </g>
  )
}
