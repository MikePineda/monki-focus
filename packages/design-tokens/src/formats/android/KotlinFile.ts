// SPDX-License-Identifier: AGPL-3.0-or-later
import { SPDX, generatedNotice } from '../GeneratedNotice.ts'

/** The Compose theme package every generated Kotlin file belongs to. */
export const KOTLIN_PACKAGE = 'dev.monkifocus.android.core.ui.theme'

/** Wraps generated Kotlin declarations with the header, package and imports. */
export function kotlinFile(
  accentKey: string,
  imports: readonly string[],
  body: readonly string[]
): string {
  return (
    [
      `// ${SPDX}`,
      `// ${generatedNotice(accentKey)}`,
      `package ${KOTLIN_PACKAGE}`,
      '',
      ...[...imports].sort().map((name) => `import ${name}`),
      '',
      ...body,
    ].join('\n') + '\n'
  )
}

/** `#rrggbb` / `#rrggbbaa` -> `Color(0xAARRGGBB)`. */
export const kotlinColor = (hex: string): string => {
  const rgb = hex.slice(1, 7).toUpperCase()
  const alpha = hex.length === 9 ? hex.slice(7, 9).toUpperCase() : 'FF'
  return `Color(0x${alpha}${rgb})`
}

/** A Kotlin Float literal: `0.2f`, `0f`, `-0.02f`. */
export const kotlinFloat = (value: number): string => `${value}f`

/** KDoc for a one-line usage note. */
export const kdoc = (text: string, indent: string): string =>
  `${indent}/** ${text.replace(/\*\//g, '* /')} */`
