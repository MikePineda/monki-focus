// SPDX-License-Identifier: AGPL-3.0-or-later
import { renderComposeColors } from './formats/android/ComposeColorsFormat.ts'
import { renderComposeDimensions } from './formats/android/ComposeDimensionFormat.ts'
import { renderComposeMotion } from './formats/android/ComposeMotionFormat.ts'
import { renderComposeTypography } from './formats/android/ComposeTypographyFormat.ts'
import { renderCss } from './formats/CssFormat.ts'
import { renderJson } from './formats/JsonFormat.ts'
import { renderSwiftColors } from './formats/macos/SwiftColorsFormat.ts'
import { renderSwiftDimensions } from './formats/macos/SwiftDimensionFormat.ts'
import { renderSwiftMotion } from './formats/macos/SwiftMotionFormat.ts'
import { renderSwiftTypography } from './formats/macos/SwiftTypographyFormat.ts'
import { resolveTokens } from './ResolvedTokens.ts'
import { ACCENT, radius, spacing } from './tokens.source.mjs'

const SPACING_SUMMARY = 'monki-focus spacing and sizing: 8 px grid with a 4 px half step.'
const RADIUS_SUMMARY = 'monki-focus corner radii: 4, 8, 12 and 16 only, plus full for dots.'

/**
 * Every generated file, keyed by its path inside packages/design-tokens and
 * sorted by path so the build output is deterministic.
 */
export function renderOutputs(accentKey: string = ACCENT): Record<string, string> {
  const tokens = resolveTokens(accentKey)
  const key = tokens.accentKey
  const files: Record<string, string> = {
    'dist/tokens.json': renderJson(tokens),
    'dist/tokens.css': renderCss(tokens),
    'dist/android/MonkiColors.kt': renderComposeColors(tokens),
    'dist/android/MonkiTypography.kt': renderComposeTypography(key),
    'dist/android/MonkiSpacing.kt': renderComposeDimensions(
      key,
      'MonkiSpacing',
      SPACING_SUMMARY,
      spacing
    ),
    'dist/android/MonkiRadius.kt': renderComposeDimensions(
      key,
      'MonkiRadius',
      RADIUS_SUMMARY,
      radius
    ),
    'dist/android/MonkiMotion.kt': renderComposeMotion(key),
    'dist/macos/MonkiColors.swift': renderSwiftColors(tokens),
    'dist/macos/MonkiTypography.swift': renderSwiftTypography(key),
    'dist/macos/MonkiSpacing.swift': renderSwiftDimensions(
      key,
      'MonkiSpacing',
      SPACING_SUMMARY,
      spacing
    ),
    'dist/macos/MonkiRadius.swift': renderSwiftDimensions(
      key,
      'MonkiRadius',
      RADIUS_SUMMARY,
      radius
    ),
    'dist/macos/MonkiMotion.swift': renderSwiftMotion(key),
  }
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}
