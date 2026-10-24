// SPDX-License-Identifier: AGPL-3.0-or-later
import { deltaE } from '../color/DeltaE.ts'
import type { ResolvedTokens } from '../ResolvedTokens.ts'
import type { Theme } from '../Theme.ts'

/**
 * The accent marks what you can act on; it must never read as a status or a
 * focus level. The floor comes from the design draft: the recommended teal's
 * closest pair is ΔE 9.4 (level-3, light) and is accepted as clearly apart,
 * while the amber alternative at ΔE 4.3 / 2.9 from status-warning is called
 * "almost on top" of it. 9 sits between the two.
 */
export const MIN_ACCENT_DELTA_E = 9

export interface AccentSeparationRow {
  readonly theme: Theme
  readonly other: string
  readonly accentHex: string
  readonly otherHex: string
  readonly deltaE: number
  readonly pass: boolean
  readonly label: string
}

/** OKLab ΔE between `accent` and every status and level token for one theme. */
export function auditAccentSeparation(tokens: ResolvedTokens, theme: Theme): AccentSeparationRow[] {
  const accentHex = tokens.color['accent']?.[theme]
  if (!accentHex) throw new Error('Missing accent')
  return tokens.colors
    .filter((token) => token.group === 'status' || token.group === 'level')
    .map((token): AccentSeparationRow => {
      const distance = deltaE(accentHex, token[theme])
      return {
        theme,
        other: token.name,
        accentHex,
        otherHex: token[theme],
        deltaE: distance,
        pass: distance >= MIN_ACCENT_DELTA_E,
        label: `${tokens.accentKey}/${theme}: accent ${accentHex} vs ${token.name} ${token[theme]} ΔE ${distance.toFixed(1)} (min ${MIN_ACCENT_DELTA_E})`,
      }
    })
}
