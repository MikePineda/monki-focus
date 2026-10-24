// SPDX-License-Identifier: AGPL-3.0-or-later
import { textStyles } from '../../tokens.source.mjs'
import { camelName } from '../TokenNames.ts'
import { kdoc, kotlinFile } from './KotlinFile.ts'

const INDENT = '    '
const FONT_WEIGHTS: Record<number, string> = {
  400: 'FontWeight.Normal',
  500: 'FontWeight.Medium',
  600: 'FontWeight.SemiBold',
}

const em = (value: number): string => (value < 0 ? `(${value}).em` : `${value}.em`)

/** `dist/android/MonkiTypography.kt`: one `TextStyle` per text style token. */
export function renderComposeTypography(accentKey: string): string {
  return kotlinFile(
    accentKey,
    [
      'androidx.compose.runtime.Immutable',
      'androidx.compose.ui.text.TextStyle',
      'androidx.compose.ui.text.font.FontFamily',
      'androidx.compose.ui.text.font.FontWeight',
      'androidx.compose.ui.unit.em',
      'androidx.compose.ui.unit.sp',
    ],
    [
      '/**',
      ' * monki-focus text styles. The native app uses the system face by default;',
      ' * pass another [FontFamily] (for example a bundled Inter) to use it everywhere.',
      ' * Tabular styles set the `tnum` feature so timers and number columns never jitter.',
      ' */',
      '@Immutable',
      'class MonkiTypography(fontFamily: FontFamily = FontFamily.Default) {',
      ...textStyles.flatMap((style, i) => [
        ...(i === 0 ? [] : ['']),
        kdoc(style.usage, INDENT),
        `${INDENT}val ${camelName(style.name)} = TextStyle(`,
        `${INDENT}${INDENT}fontFamily = fontFamily,`,
        `${INDENT}${INDENT}fontSize = ${style.size}.sp,`,
        `${INDENT}${INDENT}lineHeight = ${style.lineHeight}.sp,`,
        `${INDENT}${INDENT}fontWeight = ${FONT_WEIGHTS[style.weight] ?? `FontWeight(${style.weight})`},`,
        `${INDENT}${INDENT}letterSpacing = ${em(style.letterSpacingEm)},`,
        ...(style.tabular ? [`${INDENT}${INDENT}fontFeatureSettings = "tnum",`] : []),
        `${INDENT})`,
      ]),
      '}',
    ]
  )
}
