// SPDX-License-Identifier: AGPL-3.0-or-later
import { textStyles } from '../../tokens.source.mjs'
import { camelName } from '../TokenNames.ts'
import { swiftDoc, swiftDouble, swiftFile } from './SwiftFile.ts'

const INDENT = '    '

/** `dist/macos/MonkiTypography.swift`: one `MonkiTextStyle` per text style token. */
export function renderSwiftTypography(accentKey: string): string {
  const I = INDENT
  return swiftFile(
    accentKey,
    ['SwiftUI'],
    [
      '/// A monki-focus text style. Sizes are points; letter spacing is in em.',
      'public struct MonkiTextStyle: Sendable {',
      `${I}public let size: CGFloat`,
      `${I}public let lineHeight: CGFloat`,
      `${I}/// CSS-style weight: 400, 500 or 600.`,
      `${I}public let weight: Int`,
      `${I}public let letterSpacingEm: CGFloat`,
      `${I}/// Tabular figures (\`.monospacedDigit()\`) for timers and number columns.`,
      `${I}public let tabularFigures: Bool`,
      '',
      `${I}/// Tracking in points, for \`.tracking(_:)\`.`,
      `${I}public var tracking: CGFloat { size * letterSpacingEm }`,
      '',
      `${I}public var fontWeight: Font.Weight {`,
      `${I}${I}switch weight {`,
      `${I}${I}case ..<450: return .regular`,
      `${I}${I}case ..<550: return .medium`,
      `${I}${I}default: return .semibold`,
      `${I}${I}}`,
      `${I}}`,
      '',
      `${I}/// The font in the system face, or in \`family\` when one is given.`,
      `${I}public func font(family: String? = nil) -> Font {`,
      `${I}${I}let base = family.map { Font.custom($0, size: size) } ?? Font.system(size: size)`,
      `${I}${I}let weighted = base.weight(fontWeight)`,
      `${I}${I}return tabularFigures ? weighted.monospacedDigit() : weighted`,
      `${I}}`,
      '}',
      '',
      '/// The monki-focus type scale. The native app uses the system face by default.',
      'public enum MonkiTypography {',
      ...textStyles.flatMap((style) => [
        swiftDoc(style.usage, I),
        `${I}public static let ${camelName(style.name)} = MonkiTextStyle(size: ${style.size}, lineHeight: ${style.lineHeight}, weight: ${style.weight}, letterSpacingEm: ${swiftDouble(style.letterSpacingEm)}, tabularFigures: ${style.tabular})`,
      ]),
      '}',
    ]
  )
}
