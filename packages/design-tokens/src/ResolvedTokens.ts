// SPDX-License-Identifier: AGPL-3.0-or-later
import { oklchToHex, withAlpha } from './color/OklchToHex.ts'
import type { Theme } from './Theme.ts'
import { THEMES } from './Theme.ts'
import type { ColorGroup, ColorToken, ColorValue } from './tokens.source.mjs'
import { ACCENT, accents, colorTokens, materialRoles } from './tokens.source.mjs'

/** A colour token with its light and dark values as `#rrggbb` / `#rrggbbaa`. */
export interface ResolvedColor {
  readonly name: string
  readonly group: ColorGroup
  readonly usage: string
  readonly light: string
  readonly dark: string
}

/** Every colour of one accent option, converted to hex. */
export interface ResolvedTokens {
  readonly accentKey: string
  readonly accentLabel: string
  /** Colour tokens in source order. */
  readonly colors: readonly ResolvedColor[]
  /** The same tokens by name. */
  readonly color: Readonly<Record<string, ResolvedColor>>
  /** Material 3 roles per theme, in source order. */
  readonly material: Readonly<Record<Theme, Readonly<Record<string, string>>>>
}

/** Resolves one source value against already resolved colour tokens. */
export function resolveValue(
  value: ColorValue,
  theme: Theme,
  color: Readonly<Record<string, ResolvedColor>>
): string {
  if (value.kind === 'oklch') return oklchToHex(value)
  const target = color[value.token]
  if (!target) throw new Error(`Unknown colour token "${value.token}"`)
  return withAlpha(target[value.theme ?? theme], value.alpha)
}

const resolveSource = (
  value: ColorValue,
  theme: Theme,
  source: ReadonlyMap<string, ColorToken>,
  seen: readonly string[]
): string => {
  if (value.kind === 'oklch') return oklchToHex(value)
  if (seen.includes(value.token)) {
    throw new Error(`Colour reference cycle: ${[...seen, value.token].join(' -> ')}`)
  }
  const target = source.get(value.token)
  if (!target) throw new Error(`Unknown colour token "${value.token}"`)
  const targetTheme = value.theme ?? theme
  const hex = resolveSource(target[targetTheme], targetTheme, source, [...seen, value.token])
  return withAlpha(hex, value.alpha)
}

/** Converts the source for one accent option (the chosen one by default). */
export function resolveTokens(accentKey: string = ACCENT): ResolvedTokens {
  const accent = accents[accentKey]
  if (!accent) throw new Error(`Unknown accent "${accentKey}"`)
  const tokens = colorTokens(accentKey)
  const source = new Map(tokens.map((token) => [token.name, token]))
  const colors = tokens.map((token): ResolvedColor => ({
    name: token.name,
    group: token.group,
    usage: token.usage,
    light: resolveSource(token.light, 'light', source, [token.name]),
    dark: resolveSource(token.dark, 'dark', source, [token.name]),
  }))
  const color = Object.fromEntries(colors.map((token) => [token.name, token]))
  const roles = materialRoles(accentKey)
  const material = Object.fromEntries(
    THEMES.map((theme) => [
      theme,
      Object.fromEntries(
        Object.entries(roles[theme]).map(([role, value]) => [
          role,
          resolveValue(value, theme, color),
        ])
      ),
    ])
  ) as Record<Theme, Record<string, string>>
  return { accentKey, accentLabel: accent.label, colors, color, material }
}
