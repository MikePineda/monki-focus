// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// Inputs the app tests read, copied verbatim into the test bundle by
/// project.yml. The tests run inside the app, and an app that opens files in
/// a checkout under ~/Documents or ~/Desktop triggers a privacy prompt that
/// hangs the run, so they never read the source tree directly.
enum TestResources {
    private final class BundleMarker {}

    private static let bundle = Bundle(for: BundleMarker.self)

    /// `macos/App/Resources/Localizable.xcstrings`, uncompiled.
    static func stringCatalog() throws -> URL {
        try url(named: "Localizable", extension: "xcstrings", subdirectory: "Resources")
    }

    /// `packages/design-tokens/dist/tokens.json`.
    static func designTokens() throws -> URL {
        try url(named: "tokens", extension: "json", subdirectory: nil)
    }

    private static func url(named name: String, extension ext: String, subdirectory: String?) throws -> URL {
        guard let url = bundle.url(forResource: name, withExtension: ext, subdirectory: subdirectory) else {
            throw CocoaError(.fileReadNoSuchFile, userInfo: [NSFilePathErrorKey: "\(name).\(ext)"])
        }
        return url
    }
}
