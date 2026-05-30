// SI-prefix value parser used by the DC solver and the properties panel.
//
// Accepts the formats engineers actually type:
//   • plain        150000   0.5   .5   -3.3   +9
//   • scientific   1e3   2.2e-6   1E3
//   • SI suffix    1M  1m  4.7k  10µ  10u  100n  2.2G   (M=mega, m=milli — case matters)
//   • with units   1MΩ  9V  100mA  4.7kΩ  1mH  1MHz  220ohm
//   • RKM / infix  1k5(=1500)  2k2  4R7(=4.7)  220R  1R0  1M5  R47(=0.47)
//   • SPICE mega   1meg  1MEG  (→ 1e6)
//
// Returns a number in base units, or `defaultVal` if it can't be parsed.

// Note: 'M' = mega and 'm' = milli, so prefix lookup MUST be case-sensitive.
// 'K' is accepted as kilo (common shorthand); 'U' as micro.
const PREFIX = {
  T: 1e12, G: 1e9, M: 1e6, k: 1e3, K: 1e3,
  m: 1e-3, u: 1e-6, U: 1e-6, µ: 1e-6, n: 1e-9, p: 1e-12,
}
// The set of prefix letters, for use inside regexes.
const PCHARS = 'TGMkKmuUµnp'

export function parseValue(str, defaultVal) {
  if (str == null) return defaultVal
  let s = String(str).trim()
  if (s === '') return defaultVal

  // SPICE 'meg' → mega. Do this before single-letter handling so the 'm'/'g'
  // don't get misread. (e.g. '1meg', '4.7MEG')
  s = s.replace(/meg/gi, 'M')

  // Strip ONE trailing unit token. Only whole, known units — never a bare prefix
  // letter — so 'm'(milli)/'M'(mega) survive. Case-insensitive is safe here
  // because no unit below collides with a prefix letter.
  s = s.replace(/\s*(ohms?|Ω|Hz|var|VA|Wh|V|A|F|H|W|S)\s*$/i, '').trim()
  if (s === '') return defaultVal

  // RKM / infix notation: a prefix letter (or 'R' for the decimal point / ohms)
  // sitting between the integer and fractional digits. 4R7, 1k5, 2K2, 220R, R47.
  const rkm = s.match(new RegExp(`^([+-]?)(\\d*)(R|[${PCHARS}])(\\d*)$`))
  if (rkm) {
    const [, sign, intPart, letter, fracPart] = rkm
    if (intPart === '' && fracPart === '') return defaultVal // bare prefix like 'M'
    const mult = letter === 'R' ? 1 : PREFIX[letter]
    const num = parseFloat(`${intPart || '0'}.${fracPart || '0'}`)
    return (sign === '-' ? -1 : 1) * num * mult
  }

  // Plain / scientific number with an optional trailing SI prefix.
  const m = s.match(new RegExp(`^([+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)\\s*([${PCHARS}]?)$`))
  if (!m) return defaultVal
  const num = parseFloat(m[1])
  if (!Number.isFinite(num)) return defaultVal
  return num * (m[2] ? PREFIX[m[2]] : 1)
}

export function formatSI(value, unit = '') {
  const num = Number(value)
  if (value == null || !Number.isFinite(num)) return unit ? `?${unit}` : '?'
  const abs = Math.abs(num)
  const fmt = (v, suffix) => {
    // 3 significant figures, then drop only *fractional* trailing zeros
    // (4.70→4.7, 5.00→5) without clobbering integers (parseFloat('100')→'100').
    const s = parseFloat(v.toPrecision(3)).toString()
    return `${s}${suffix}${unit}`
  }
  if (abs === 0) return `0${unit}`
  if (abs >= 1e9)  return fmt(num / 1e9, 'G')
  if (abs >= 1e6)  return fmt(num / 1e6, 'M')
  if (abs >= 1e3)  return fmt(num / 1e3, 'k')
  if (abs >= 1)    return fmt(num, '')
  if (abs >= 1e-3) return fmt(num * 1e3, 'm')
  if (abs >= 1e-6) return fmt(num * 1e6, 'µ')
  if (abs >= 1e-9) return fmt(num * 1e9, 'n')
  return fmt(num * 1e12, 'p')
}
