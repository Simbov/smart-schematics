import React from 'react'

export default function CustomSymbol({ svgPathData }) {
  if (!svgPathData) return null

  const trimmed = svgPathData.trim()

  if (trimmed.startsWith('<')) {
    // SVG snippet — strip outer <svg> wrapper if present and render inner content
    const svgMatch = trimmed.match(/^<svg[^>]*>([\s\S]*)<\/svg>$/i)
    const inner = svgMatch ? svgMatch[1] : trimmed
    return <g dangerouslySetInnerHTML={{ __html: inner }} />
  }

  // Raw path d= attribute value
  return (
    <path
      d={trimmed}
      stroke="currentColor"
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}
