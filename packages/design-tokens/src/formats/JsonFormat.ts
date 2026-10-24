// SPDX-License-Identifier: AGPL-3.0-or-later
import { resolveElevation } from '../ResolvedElevation.ts'
import type { ResolvedTokens } from '../ResolvedTokens.ts'
import { THEMES } from '../Theme.ts'
import {
  RECOMMENDED_ACCENT,
  accents,
  durations,
  easings,
  fontFamilies,
  icons,
  radius,
  spacing,
  textStyles,
} from '../tokens.source.mjs'
import { generatedNotice } from './GeneratedNotice.ts'
import { camelName, cssVariableName, swiftColorName } from './TokenNames.ts'

export const DESIGN_STATUS = 'draft pending maintainer approval of the accent'

/** `dist/tokens.json`: every token as platform-neutral data. */
export function renderJson(tokens: ResolvedTokens): string {
  const data = {
    $comment: generatedNotice(tokens.accentKey),
    name: 'monki-focus',
    status: DESIGN_STATUS,
    themes: THEMES,
    defaultTheme: 'light',
    accent: {
      chosen: tokens.accentKey,
      label: tokens.accentLabel,
      recommended: RECOMMENDED_ACCENT,
      options: Object.keys(accents),
    },
    color: tokens.colors.map((token) => ({
      name: token.name,
      group: token.group,
      light: token.light,
      dark: token.dark,
      usage: token.usage,
      css: cssVariableName(token.name),
      compose: camelName(token.name),
      swift: swiftColorName(token.name),
    })),
    material: {
      note: 'Material 3 roles for Stitch and Compose. Primary is ink; tertiary carries the accent.',
      light: tokens.material.light,
      dark: tokens.material.dark,
    },
    typography: {
      families: fontFamilies,
      weights: [...new Set(textStyles.map((style) => style.weight))].sort((a, b) => a - b),
      styles: textStyles,
    },
    spacing,
    radius,
    motion: {
      durations,
      easings: easings.map(({ name, x1, y1, x2, y2, usage }) => ({
        name,
        cubicBezier: [x1, y1, x2, y2],
        usage,
      })),
      reducedMotion:
        'Breath circle stays still; overlay and toasts use opacity only (100ms); segments jump.',
    },
    elevation: resolveElevation(tokens),
    icons,
  }
  return JSON.stringify(data, null, 2) + '\n'
}
