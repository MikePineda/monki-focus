// SPDX-License-Identifier: AGPL-3.0-or-later
import { durations, easings } from '../../tokens.source.mjs'
import { camelName, constantName } from '../TokenNames.ts'
import { kdoc, kotlinFile, kotlinFloat } from './KotlinFile.ts'

const INDENT = '    '

/** `dist/android/MonkiMotion.kt`: durations in milliseconds and easing curves. */
export function renderComposeMotion(accentKey: string): string {
  return kotlinFile(
    accentKey,
    ['androidx.compose.animation.core.CubicBezierEasing', 'androidx.compose.animation.core.Easing'],
    [
      '/** monki-focus motion: only the breath, overlays, toasts and segments move. */',
      'object MonkiMotion {',
      ...durations.flatMap((duration) => [
        kdoc(duration.usage, INDENT),
        `${INDENT}const val ${constantName(duration.name)}_MS: Int = ${duration.ms}`,
      ]),
      ...easings.flatMap((easing) => [
        kdoc(easing.usage, INDENT),
        `${INDENT}val ${camelName(easing.name)}: Easing = CubicBezierEasing(${[
          easing.x1,
          easing.y1,
          easing.x2,
          easing.y2,
        ]
          .map(kotlinFloat)
          .join(', ')})`,
      ]),
      '}',
    ]
  )
}
