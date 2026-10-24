// SPDX-License-Identifier: AGPL-3.0-or-later

import AppKit
import Foundation
import SwiftUI
import Testing

@testable import MonkiFocus

/// The app compiles the generated `MonkiColors.swift` straight from
/// `packages/design-tokens/dist/macos`. Every colour token has its Swift
/// name in the app, and each resolves to the token's light and dark value.
@MainActor
@Suite("Theme colours")
struct ThemeColorTests {
    private struct TokenFile: Decodable {
        struct ColorToken: Decodable {
            let swift: String
            let light: String
            let dark: String
        }

        let color: [ColorToken]
    }

    /// Referencing each colour here fails the build if a name is missing.
    private static let appColors: [String: Color] = [
        "monkiSurface0": .monkiSurface0,
        "monkiSurface1": .monkiSurface1,
        "monkiSurface2": .monkiSurface2,
        "monkiScrim": .monkiScrim,
        "monkiInk1": .monkiInk1,
        "monkiInk2": .monkiInk2,
        "monkiInk3": .monkiInk3,
        "monkiLine": .monkiLine,
        "monkiLineStrong": .monkiLineStrong,
        "monkiAccent": .monkiAccent,
        "monkiAccentHover": .monkiAccentHover,
        "monkiAccentInk": .monkiAccentInk,
        "monkiAccentSoft": .monkiAccentSoft,
        "monkiFocus": .monkiFocus,
        "monkiLevel0": .monkiLevel0,
        "monkiLevel1": .monkiLevel1,
        "monkiLevel2": .monkiLevel2,
        "monkiLevel3": .monkiLevel3,
        "monkiLevel4": .monkiLevel4,
        "monkiMarkNeutral": .monkiMarkNeutral,
        "monkiMarkMuted": .monkiMarkMuted,
        "monkiGridline": .monkiGridline,
        "monkiBaseline": .monkiBaseline,
        "monkiStatusGood": .monkiStatusGood,
        "monkiStatusWarning": .monkiStatusWarning,
        "monkiStatusCritical": .monkiStatusCritical,
    ]

    private static func tokens() throws -> [TokenFile.ColorToken] {
        try JSONDecoder().decode(TokenFile.self, from: Data(contentsOf: TestResources.designTokens())).color
    }

    /// `#rrggbb`, or `#rrggbbaa` when not opaque, as in `tokens.json`.
    private static func hex(of color: Color, in appearanceName: NSAppearance.Name) throws -> String {
        let appearance = try #require(NSAppearance(named: appearanceName))
        var srgb: NSColor?
        appearance.performAsCurrentDrawingAppearance {
            srgb = NSColor(color).usingColorSpace(.sRGB)
        }
        let resolved = try #require(srgb)
        let channels = [
            resolved.redComponent, resolved.greenComponent, resolved.blueComponent, resolved.alphaComponent,
        ]
        .map { Int(($0 * 255).rounded()) }
        let rgb = channels.prefix(3).map { String(format: "%02x", $0) }.joined()
        return "#" + rgb + (channels[3] == 255 ? "" : String(format: "%02x", channels[3]))
    }

    @Test("every colour token exists in the app")
    func everyColourTokenExistsInTheApp() throws {
        let tokenNames = Set(try Self.tokens().map(\.swift))

        #expect(tokenNames == Set(Self.appColors.keys))
    }

    @Test("colours follow the light and dark appearance")
    func coloursFollowTheLightAndDarkAppearance() throws {
        for token in try Self.tokens() {
            let color = try #require(Self.appColors[token.swift], "\(token.swift) is not in the app")
            #expect(try Self.hex(of: color, in: .aqua) == token.light, "\(token.swift) light")
            #expect(try Self.hex(of: color, in: .darkAqua) == token.dark, "\(token.swift) dark")
        }
    }
}
