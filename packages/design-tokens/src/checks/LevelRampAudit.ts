// SPDX-License-Identifier: AGPL-3.0-or-later
import { contrastRatio } from '../color/ContrastRatio.ts'
import { hexToOklch } from '../color/HexToOklab.ts'
import type { ResolvedTokens } from '../ResolvedTokens.ts'
import type { Theme } from '../Theme.ts'

/**
 * Ordinal-ramp checks for the focus-level steps, ported from the palette
 * validator the design draft ran: lightness moves away from the surface step
 * by step, adjacent steps differ visibly, the step nearest the surface still
 * clears it, and the ramp keeps one hue.
 */
export const LEVEL_TOKENS = ['level-0', 'level-1', 'level-2', 'level-3', 'level-4'] as const
export const LEVEL_RAMP_SURFACES = ['surface-0', 'surface-1'] as const
export const MIN_ADJACENT_DELTA_L = 0.06
export const MIN_END_CONTRAST = 2
export const MAX_HUE_SPREAD_DEGREES = 10

export type LevelRampCheckName =
  'lightness-monotone' | 'adjacent-delta-l' | 'end-contrast' | 'single-hue'

export interface LevelRampCheck {
  readonly theme: Theme
  readonly surface: string
  readonly check: LevelRampCheckName
  readonly pass: boolean
  readonly detail: string
  readonly label: string
}

const hueSpread = (hues: readonly number[]): number => {
  const sorted = [...hues].sort((a, b) => a - b)
  // The spread is 360 minus the largest gap between neighbours on the circle.
  let largestGap = 0
  sorted.forEach((hue, i) => {
    const next = i === sorted.length - 1 ? (sorted[0] ?? hue) + 360 : (sorted[i + 1] ?? hue)
    largestGap = Math.max(largestGap, next - hue)
  })
  return 360 - largestGap
}

/** Runs the four ramp checks for one theme against one surface. */
export function auditLevelRamp(
  tokens: ResolvedTokens,
  theme: Theme,
  surface: string
): LevelRampCheck[] {
  const hexes = LEVEL_TOKENS.map((name) => {
    const token = tokens.color[name]
    if (!token) throw new Error(`Missing ${name}`)
    return token[theme]
  })
  const surfaceHex = tokens.color[surface]?.[theme]
  if (!surfaceHex) throw new Error(`Missing ${surface}`)
  const lch = hexes.map(hexToOklch)
  const lightness = lch.map((c) => c.l)
  // Level 0 sits nearest the surface; every further step moves away from it.
  const direction = theme === 'light' ? -1 : 1
  const steps = lightness.slice(1).map((l, i) => (l - (lightness[i] ?? l)) * direction)
  const monotone = steps.every((step) => step > 0)
  const smallestStep = Math.min(...steps.map(Math.abs))
  const endContrast = contrastRatio(hexes[0] ?? surfaceHex, surfaceHex)
  const spread = hueSpread(lch.map((c) => c.h))

  const result = (check: LevelRampCheckName, pass: boolean, detail: string): LevelRampCheck => ({
    theme,
    surface,
    check,
    pass,
    detail,
    label: `${tokens.accentKey}/${theme} on ${surface} ${surfaceHex}: ${check} (${detail})`,
  })
  return [
    result(
      'lightness-monotone',
      monotone,
      theme === 'light' ? 'steps read light to dark' : 'steps read dark to light'
    ),
    result(
      'adjacent-delta-l',
      smallestStep >= MIN_ADJACENT_DELTA_L,
      `smallest gap ${smallestStep.toFixed(3)}, min ${MIN_ADJACENT_DELTA_L}`
    ),
    result(
      'end-contrast',
      endContrast >= MIN_END_CONTRAST,
      `level-0 ${hexes[0]} at ${endContrast.toFixed(2)}:1, min ${MIN_END_CONTRAST}:1`
    ),
    result(
      'single-hue',
      spread <= MAX_HUE_SPREAD_DEGREES,
      `hue spread ${spread.toFixed(1)}°, max ${MAX_HUE_SPREAD_DEGREES}°`
    ),
  ]
}
