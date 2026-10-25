// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import Testing

/// SEMANTICS.md §5.7: `frictionCandidates` and `budgetedRulesFor` against every `candidates` fixture.
@Suite("candidates fixtures")
struct CandidatesFixturesTests {
    @Test("candidates", arguments: try FixtureLoader.load("candidates"))
    func candidates(_ fixture: Fixture) throws {
        let parsed = try fixture.decode(CandidatesFixture.self)
        let given = parsed.given
        let catalog = try RulesPackage.catalog()
        let observation = parsed.when.target
        let actual = CandidatesFixture.Then(
            frictionCandidates: frictionCandidates(
                given.ruleset, observation: observation, now: given.now, catalog: catalog),
            budgetedRules: budgetedRulesFor(given.ruleset, observation: observation, at: given.now, catalog: catalog)
        )
        #expect(actual == parsed.then)
    }
}
