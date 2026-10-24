// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCoreTesting
import Testing

/// Swift runs the same conformance fixtures as TypeScript and Kotlin, read
/// straight from `packages/rules/fixtures` relative to `#filePath`.
@Suite("Shared fixtures")
struct SharedFixturesTests {
    private struct FixtureHeader: Decodable {
        let id: String
        let kind: String
    }

    @Test("a shared rules fixture is read from the repository")
    func aSharedRulesFixtureIsReadFromTheRepository() throws {
        let data = try SharedFixtures.data(kind: "url-normalize", name: "empty_segments_are_removed")

        let header = try JSONDecoder().decode(FixtureHeader.self, from: data)

        #expect(header.id == "url-normalize.empty_segments_are_removed")
        #expect(header.kind == "url-normalize")
    }

    @Test("every fixture of a kind is listed with its id")
    func everyFixtureOfAKindIsListedWithItsId() throws {
        let files = try SharedFixtures.files(kind: "url-normalize")

        #expect(!files.isEmpty)
        for file in files {
            let header = try JSONDecoder().decode(FixtureHeader.self, from: Data(contentsOf: file))
            #expect(header.id == "url-normalize.\(file.deletingPathExtension().lastPathComponent)")
        }
    }

    @Test("an unknown fixture kind is an error, not an empty list")
    func anUnknownFixtureKindIsAnErrorNotAnEmptyList() {
        #expect(throws: (any Error).self) {
            try SharedFixtures.files(kind: "no-such-kind")
        }
    }
}
