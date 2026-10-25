// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// Locations in the monorepo checkout, derived from this file's `#filePath`
/// (`macos/Packages/MonkiCore/Sources/MonkiCoreTesting/RepositoryPaths.swift`),
/// so tests read shared files without copying them and without assuming a
/// working directory. Works under `swift test` and `xcodebuild test`.
public enum RepositoryPaths {
    /// The repository root (six levels above this file).
    public static let root: URL = {
        var url = URL(filePath: #filePath)
        for _ in 0..<6 {
            url.deleteLastPathComponent()
        }
        return url
    }()

    /// `packages/rules`: schemas, rules data and fixtures.
    public static let rulesPackage = root.appending(path: "packages/rules", directoryHint: .isDirectory)

    /// `packages/rules/fixtures`: the cross-platform conformance fixtures.
    public static let rulesFixtures = root.appending(path: "packages/rules/fixtures", directoryHint: .isDirectory)

    /// The sources of the pure MonkiCore module.
    public static let monkiCoreSources = root.appending(
        path: "macos/Packages/MonkiCore/Sources/MonkiCore",
        directoryHint: .isDirectory
    )
}
