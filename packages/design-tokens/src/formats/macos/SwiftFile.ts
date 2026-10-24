// SPDX-License-Identifier: AGPL-3.0-or-later
import { SPDX, generatedNotice } from '../GeneratedNotice.ts'

/** Wraps generated Swift declarations with the header and imports. */
export function swiftFile(
  accentKey: string,
  imports: readonly string[],
  body: readonly string[]
): string {
  return (
    [
      `// ${SPDX}`,
      `// ${generatedNotice(accentKey)}`,
      ...imports.map((name) => `import ${name}`),
      '',
      ...body,
    ].join('\n') + '\n'
  )
}

/** `#rrggbb` / `#rrggbbaa` -> `0xRRGGBBAA`. */
export const swiftRgba = (hex: string): string => {
  const rgb = hex.slice(1, 7).toUpperCase()
  const alpha = hex.length === 9 ? hex.slice(7, 9).toUpperCase() : 'FF'
  return `0x${rgb}${alpha}`
}

/** A Swift Double literal that always reads as floating point: `0.15`, `4.0`. */
export const swiftDouble = (value: number): string =>
  Number.isInteger(value) ? value.toFixed(1) : `${value}`

/** A one-line doc comment. */
export const swiftDoc = (text: string, indent: string): string => `${indent}/// ${text}`
