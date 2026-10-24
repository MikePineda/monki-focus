// SPDX-License-Identifier: AGPL-3.0-or-later
import { durations, easings } from '../../tokens.source.mjs'
import { camelName } from '../TokenNames.ts'
import { swiftDoc, swiftDouble, swiftFile } from './SwiftFile.ts'

const INDENT = '    '

/** `dist/macos/MonkiMotion.swift`: durations in seconds and easing curves. */
export function renderSwiftMotion(accentKey: string): string {
  const I = INDENT
  return swiftFile(
    accentKey,
    ['SwiftUI'],
    [
      '/// monki-focus motion: only the breath, overlays, toasts and segments move.',
      'public enum MonkiMotion {',
      ...durations.flatMap((duration) => [
        swiftDoc(duration.usage, I),
        `${I}public static let ${camelName(duration.name)}: TimeInterval = ${swiftDouble(duration.ms / 1000)}`,
      ]),
      ...easings.flatMap((easing) => [
        swiftDoc(`${easing.usage} A timing curve with the given duration.`, I),
        `${I}public static func ${camelName(easing.name)}(duration: TimeInterval) -> Animation {`,
        `${I}${I}.timingCurve(${[easing.x1, easing.y1, easing.x2, easing.y2].join(', ')}, duration: duration)`,
        `${I}}`,
      ]),
      '}',
    ]
  )
}
