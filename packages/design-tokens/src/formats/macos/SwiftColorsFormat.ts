// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ResolvedTokens } from '../../ResolvedTokens.ts'
import { swiftColorName } from '../TokenNames.ts'
import { swiftDoc, swiftFile, swiftRgba } from './SwiftFile.ts'

const INDENT = '    '

/**
 * `dist/macos/MonkiColors.swift`: one SwiftUI `Color` per semantic token whose
 * light/dark value follows the system appearance through a dynamic
 * NSColor/UIColor provider, so no asset catalog is needed.
 */
export function renderSwiftColors(tokens: ResolvedTokens): string {
  return swiftFile(
    tokens.accentKey,
    ['SwiftUI'],
    [
      '#if canImport(AppKit)',
      'import AppKit',
      '#elseif canImport(UIKit)',
      'import UIKit',
      '#endif',
      '',
      'extension Color {',
      ...tokens.colors.flatMap((token) => [
        swiftDoc(token.usage, INDENT),
        `${INDENT}public static let ${swiftColorName(token.name)} = Color.monkiDynamic(light: ${swiftRgba(token.light)}, dark: ${swiftRgba(token.dark)})`,
      ]),
      '',
      `${INDENT}/// A colour that follows the system appearance; values are sRGB 0xRRGGBBAA.`,
      `${INDENT}static func monkiDynamic(light: UInt32, dark: UInt32) -> Color {`,
      `${INDENT}${INDENT}#if canImport(AppKit)`,
      `${INDENT}${INDENT}return Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in`,
      `${INDENT}${INDENT}${INDENT}let isDark = appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua`,
      `${INDENT}${INDENT}${INDENT}let rgba = MonkiRGBA(isDark ? dark : light)`,
      `${INDENT}${INDENT}${INDENT}return NSColor(srgbRed: rgba.red, green: rgba.green, blue: rgba.blue, alpha: rgba.alpha)`,
      `${INDENT}${INDENT}}))`,
      `${INDENT}${INDENT}#elseif canImport(UIKit)`,
      `${INDENT}${INDENT}return Color(uiColor: UIColor { traits in`,
      `${INDENT}${INDENT}${INDENT}let rgba = MonkiRGBA(traits.userInterfaceStyle == .dark ? dark : light)`,
      `${INDENT}${INDENT}${INDENT}return UIColor(red: rgba.red, green: rgba.green, blue: rgba.blue, alpha: rgba.alpha)`,
      `${INDENT}${INDENT}})`,
      `${INDENT}${INDENT}#endif`,
      `${INDENT}}`,
      '}',
      '',
      '/// sRGB components of a 0xRRGGBBAA value.',
      'struct MonkiRGBA {',
      `${INDENT}let red: CGFloat`,
      `${INDENT}let green: CGFloat`,
      `${INDENT}let blue: CGFloat`,
      `${INDENT}let alpha: CGFloat`,
      '',
      `${INDENT}init(_ value: UInt32) {`,
      `${INDENT}${INDENT}red = CGFloat((value >> 24) & 0xFF) / 255`,
      `${INDENT}${INDENT}green = CGFloat((value >> 16) & 0xFF) / 255`,
      `${INDENT}${INDENT}blue = CGFloat((value >> 8) & 0xFF) / 255`,
      `${INDENT}${INDENT}alpha = CGFloat(value & 0xFF) / 255`,
      `${INDENT}}`,
      '}',
    ]
  )
}
