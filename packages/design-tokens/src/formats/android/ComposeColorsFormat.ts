// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ResolvedTokens } from '../../ResolvedTokens.ts'
import type { Theme } from '../../Theme.ts'
import { camelName } from '../TokenNames.ts'
import { kdoc, kotlinColor, kotlinFile } from './KotlinFile.ts'

const INDENT = '    '

/**
 * Material roles passed to `lightColorScheme` / `darkColorScheme`. The `*-fixed`
 * roles are left out: they are not parameters of the stable builders, and
 * Compose derives them. They stay in tokens.json for Stitch.
 */
const isSchemeRole = (role: string): boolean => !role.includes('fixed')

const scheme = (tokens: ResolvedTokens, theme: Theme): string[] => {
  const builder = theme === 'light' ? 'lightColorScheme' : 'darkColorScheme'
  const name = theme === 'light' ? 'MonkiLightColorScheme' : 'MonkiDarkColorScheme'
  return [
    `/** Material 3 ${theme} scheme: primary is ink, tertiary carries the accent. */`,
    `val ${name}: ColorScheme = ${builder}(`,
    ...Object.entries(tokens.material[theme])
      .filter(([role]) => isSchemeRole(role))
      .map(([role, hex]) => `${INDENT}${camelName(role)} = ${kotlinColor(hex)},`),
    ')',
  ]
}

const semanticInstance = (tokens: ResolvedTokens, theme: Theme): string[] => {
  const name = theme === 'light' ? 'MonkiLightColors' : 'MonkiDarkColors'
  return [
    `/** Semantic monki-focus colours, ${theme} theme. */`,
    `val ${name} = MonkiColors(`,
    ...tokens.colors.map(
      (token) => `${INDENT}${camelName(token.name)} = ${kotlinColor(token[theme])},`
    ),
    ')',
  ]
}

/** `dist/android/MonkiColors.kt`: Material schemes plus every semantic token. */
export function renderComposeColors(tokens: ResolvedTokens): string {
  return kotlinFile(
    tokens.accentKey,
    [
      'androidx.compose.material3.ColorScheme',
      'androidx.compose.material3.darkColorScheme',
      'androidx.compose.material3.lightColorScheme',
      'androidx.compose.runtime.Immutable',
      'androidx.compose.runtime.staticCompositionLocalOf',
      'androidx.compose.ui.graphics.Color',
    ],
    [
      '/**',
      ' * Every semantic monki-focus colour, including the ones Material 3 has no role',
      ' * for (focus levels, chart marks, status, scrim). Components read these',
      ' * through [LocalMonkiColors]; never a raw colour.',
      ' */',
      '@Immutable',
      'data class MonkiColors(',
      ...tokens.colors.flatMap((token) => [
        kdoc(token.usage, INDENT),
        `${INDENT}val ${camelName(token.name)}: Color,`,
      ]),
      ')',
      '',
      ...semanticInstance(tokens, 'light'),
      '',
      ...semanticInstance(tokens, 'dark'),
      '',
      ...scheme(tokens, 'light'),
      '',
      ...scheme(tokens, 'dark'),
      '',
      '/** The semantic colours of the current theme; the theme provides the dark set. */',
      'val LocalMonkiColors = staticCompositionLocalOf { MonkiLightColors }',
    ]
  )
}
