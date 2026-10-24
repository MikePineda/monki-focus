// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ResolvedTokens } from './ResolvedTokens.ts'
import { resolveValue } from './ResolvedTokens.ts'
import type { Theme } from './Theme.ts'
import { THEMES } from './Theme.ts'
import { elevation } from './tokens.source.mjs'

/** An elevation level with its CSS `box-shadow` per theme (`none` when flat). */
export interface ResolvedElevation {
  readonly name: string
  readonly light: string
  readonly dark: string
  readonly border: string | null
  readonly usage: string
}

export function resolveElevation(tokens: ResolvedTokens): ResolvedElevation[] {
  return elevation.map((level) => {
    const shadow = (theme: Theme): string => {
      const layers = level[theme]
      if (layers.length === 0) return 'none'
      return layers
        .map(
          (layer) =>
            `0 ${layer.y}px ${layer.blur}px ${resolveValue(layer.color, theme, tokens.color)}`
        )
        .join(', ')
    }
    const [light, dark] = THEMES.map(shadow) as [string, string]
    return { name: level.name, light, dark, border: level.border, usage: level.usage }
  })
}
