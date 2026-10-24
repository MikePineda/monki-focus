// SPDX-License-Identifier: AGPL-3.0-or-later
import { resolveElevation } from '../ResolvedElevation.ts'
import type { ResolvedTokens } from '../ResolvedTokens.ts'
import type { Theme } from '../Theme.ts'
import { durations, easings, radius, spacing, textStyles } from '../tokens.source.mjs'
import { cssVariableName } from '../formats/TokenNames.ts'
import { code, markdownTable } from './MarkdownTable.ts'

const firstSentence = (usage: string): string => usage.split('. ')[0]?.replace(/\.$/, '') + '.'

/** Every colour token with its light and dark value and a short use. */
export const lightDarkTable = (tokens: ResolvedTokens): string =>
  markdownTable(
    ['Token', 'Light', 'Dark', 'Use'],
    tokens.colors.map((token) => [
      code(token.name),
      code(token.light),
      code(token.dark),
      firstSentence(token.usage),
    ])
  )

/** One theme's colour tokens as CSS variables with the full usage note. */
export const themeTable = (tokens: ResolvedTokens, theme: Theme): string =>
  markdownTable(
    ['Token', 'Hex', 'Use'],
    tokens.colors.map((token) => [
      code(cssVariableName(token.name)),
      code(token[theme]),
      token.usage,
    ])
  )

/** Material 3 roles for one theme. */
export const materialTable = (tokens: ResolvedTokens, theme: Theme): string =>
  markdownTable(
    ['Role', 'Hex'],
    Object.entries(tokens.material[theme]).map(([role, hex]) => [role, code(hex)])
  )

const signedEm = (value: number): string =>
  value === 0 ? '0' : `${value > 0 ? '+' : '−'}${Math.abs(value)}em`

/** The type scale. */
export const typographyTable = (): string =>
  markdownTable(
    ['Style', 'Size / line', 'Weight', 'Tracking', 'Figures', 'Use'],
    textStyles.map((style) => [
      code(style.name),
      `${style.size} / ${style.lineHeight}`,
      `${style.weight}`,
      signedEm(style.letterSpacingEm),
      style.tabular ? 'tabular' : 'proportional',
      style.usage,
    ])
  )

/** Spacing, sizing and radius scales. */
export const scaleTable = (): string =>
  markdownTable(
    ['Token', 'Value', 'Use'],
    [...spacing, ...radius].map((value) => [code(value.name), `${value.px}px`, value.usage])
  )

/** Durations, easings and elevation. */
export const motionTable = (tokens: ResolvedTokens): string =>
  markdownTable(
    ['Token', 'Value', 'Use'],
    [
      ...durations.map((duration) => [code(duration.name), `${duration.ms}ms`, duration.usage]),
      ...easings.map((easing) => [
        code(easing.name),
        code(`cubic-bezier(${easing.x1}, ${easing.y1}, ${easing.x2}, ${easing.y2})`),
        easing.usage,
      ]),
      ...resolveElevation(tokens).map((level) => [
        code(level.name),
        level.light === level.dark
          ? code(level.light)
          : `light ${code(level.light)}, dark ${code(level.dark)}`,
        level.usage,
      ]),
    ]
  )
