// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// Reads the shared conformance fixtures in `packages/rules/fixtures/<kind>/`.
/// Feed `files(kind:)` to `@Test(arguments:)` to run one test per fixture.
public enum SharedFixtures {
    /// Every `*.json` fixture of `kind`, sorted by name. Throws when the kind
    /// directory does not exist, so a typo never yields an empty, green suite.
    public static func files(kind: String) throws -> [URL] {
        let directory = RepositoryPaths.rulesFixtures.appending(path: kind, directoryHint: .isDirectory)
        return try FileManager.default
            .contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "json" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
    }

    /// The raw bytes of `packages/rules/fixtures/<kind>/<name>.json`.
    public static func data(kind: String, name: String) throws -> Data {
        try Data(contentsOf: RepositoryPaths.rulesFixtures.appending(path: "\(kind)/\(name).json"))
    }
}
