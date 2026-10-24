// SPDX-License-Identifier: AGPL-3.0-or-later
import { camelName } from '../TokenNames.ts'
import { swiftDoc, swiftFile } from './SwiftFile.ts'

const INDENT = '    '

/**
 * A Swift namespace of `CGFloat` values, used for `MonkiSpacing.swift` and
 * `MonkiRadius.swift` (px in the source are points on macOS).
 */
export function renderSwiftDimensions(
  accentKey: string,
  enumName: string,
  summary: string,
  values: readonly { name: string; px: number; usage: string }[]
): string {
  return swiftFile(
    accentKey,
    ['CoreGraphics'],
    [
      `/// ${summary}`,
      `public enum ${enumName} {`,
      ...values.flatMap((value) => [
        swiftDoc(value.usage, INDENT),
        `${INDENT}public static let ${camelName(value.name)}: CGFloat = ${value.px}`,
      ]),
      '}',
    ]
  )
}
