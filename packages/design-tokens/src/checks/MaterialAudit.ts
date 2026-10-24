// SPDX-License-Identifier: AGPL-3.0-or-later
import { contrastRatio } from '../color/ContrastRatio.ts'
import type { ResolvedTokens } from '../ResolvedTokens.ts'
import type { Theme } from '../Theme.ts'

/** Material on-X / X pairs that carry text; each must reach 4.5:1. */
export const MATERIAL_TEXT_PAIRS: readonly (readonly [string, string])[] = [
  ['on-background', 'background'],
  ['on-surface', 'surface'],
  ['on-surface', 'surface-container-highest'],
  ['on-surface-variant', 'surface-variant'],
  ['inverse-on-surface', 'inverse-surface'],
  ['on-primary', 'primary'],
  ['on-primary-container', 'primary-container'],
  ['on-secondary', 'secondary'],
  ['on-secondary-container', 'secondary-container'],
  ['on-tertiary', 'tertiary'],
  ['on-tertiary-container', 'tertiary-container'],
  ['on-error', 'error'],
  ['on-error-container', 'error-container'],
  ['on-primary-fixed', 'primary-fixed'],
  ['on-primary-fixed-variant', 'primary-fixed'],
  ['on-tertiary-fixed', 'tertiary-fixed'],
  ['on-tertiary-fixed', 'tertiary-fixed-dim'],
  ['on-tertiary-fixed-variant', 'tertiary-fixed'],
]

export const MATERIAL_MIN_CONTRAST = 4.5

export interface MaterialRow {
  readonly theme: Theme
  readonly fg: string
  readonly bg: string
  readonly fgHex: string
  readonly bgHex: string
  readonly ratio: number
  readonly pass: boolean
  readonly label: string
}

/** Evaluates every Material text pair for one theme. */
export function auditMaterial(tokens: ResolvedTokens, theme: Theme): MaterialRow[] {
  const roles = tokens.material[theme]
  return MATERIAL_TEXT_PAIRS.map(([fg, bg]): MaterialRow => {
    const fgHex = roles[fg]
    const bgHex = roles[bg]
    if (!fgHex || !bgHex) throw new Error(`Unknown Material role in ${fg} / ${bg}`)
    const ratio = contrastRatio(fgHex, bgHex)
    return {
      theme,
      fg,
      bg,
      fgHex,
      bgHex,
      ratio,
      pass: ratio >= MATERIAL_MIN_CONTRAST,
      label: `${tokens.accentKey}/${theme}: ${fg} ${fgHex} on ${bg} ${bgHex} = ${ratio.toFixed(2)}:1`,
    }
  })
}
