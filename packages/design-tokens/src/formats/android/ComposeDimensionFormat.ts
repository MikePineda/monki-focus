// SPDX-License-Identifier: AGPL-3.0-or-later
import { camelName } from '../TokenNames.ts'
import { kdoc, kotlinFile } from './KotlinFile.ts'

const INDENT = '    '

/**
 * A Kotlin `object` of `Dp` values, used for `MonkiSpacing.kt` and
 * `MonkiRadius.kt` (px in the source are dp on Android).
 */
export function renderComposeDimensions(
  accentKey: string,
  objectName: string,
  summary: string,
  values: readonly { name: string; px: number; usage: string }[]
): string {
  return kotlinFile(
    accentKey,
    ['androidx.compose.ui.unit.Dp', 'androidx.compose.ui.unit.dp'],
    [
      `/** ${summary} */`,
      `object ${objectName} {`,
      ...values.flatMap((value) => [
        kdoc(value.usage, INDENT),
        `${INDENT}val ${camelName(value.name)}: Dp = ${value.px}.dp`,
      ]),
      '}',
    ]
  )
}
