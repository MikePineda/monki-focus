// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import Testing

/// SEMANTICS.md §2: `normalizeUrl` against every `url-normalize` fixture.
@Suite("url-normalize fixtures")
struct UrlNormalizeFixturesTests {
    @Test("url-normalize", arguments: try FixtureLoader.load("url-normalize"))
    func urlNormalize(_ fixture: Fixture) throws {
        let parsed = try fixture.decode(UrlNormalizeFixture.self)
        #expect(normalizeUrl(parsed.given.urlText, catalog: try RulesPackage.catalog()) == parsed.then)
    }
}
