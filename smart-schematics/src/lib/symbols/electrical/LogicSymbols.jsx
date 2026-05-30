import React from 'react'

const SW = 1.5

function GateBody({ label, bubble = false }) {
  return (
    <g>
      <line x1="-20" y1="-8" x2="-10" y2="-8" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-20" y1="8" x2="-10" y2="8" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <rect x="-10" y="-14" width="20" height="28" stroke="currentColor" strokeWidth={SW} fill="none" />
      {bubble
        ? <><circle cx="13" cy="0" r="3" stroke="currentColor" strokeWidth={SW} fill="none" /><line x1="16" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" /></>
        : <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      }
      <text x="0" y="0" fontSize="8" fill="currentColor" textAnchor="middle" dominantBaseline="middle">{label}</text>
    </g>
  )
}

function SingleInputGateBody({ label, bubble = false }) {
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <rect x="-10" y="-10" width="20" height="20" stroke="currentColor" strokeWidth={SW} fill="none" />
      {bubble
        ? <><circle cx="13" cy="0" r="3" stroke="currentColor" strokeWidth={SW} fill="none" /><line x1="16" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" /></>
        : <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      }
      <text x="0" y="0" fontSize="8" fill="currentColor" textAnchor="middle" dominantBaseline="middle">{label}</text>
    </g>
  )
}

export function GateAndSymbol() { return <GateBody label="&amp;" /> }
export function GateOrSymbol() { return <GateBody label="≥1" /> }
export function GateNandSymbol() { return <GateBody label="&amp;" bubble /> }
export function GateNorSymbol() { return <GateBody label="≥1" bubble /> }
export function GateXorSymbol() { return <GateBody label="=1" /> }
export function GateXnorSymbol() { return <GateBody label="=1" bubble /> }
export function GateNotSymbol() { return <SingleInputGateBody label="1" bubble /> }
export function GateBufferSymbol() { return <SingleInputGateBody label="1" /> }

export function SchmittTriggerSymbol() {
  return (
    <g>
      <line x1="-20" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <rect x="-10" y="-10" width="20" height="20" stroke="currentColor" strokeWidth={SW} fill="none" />
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <path d="M -5,3 L -5,-3 L 0,-3 L 0,3 L 5,3 L 5,-3" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}
