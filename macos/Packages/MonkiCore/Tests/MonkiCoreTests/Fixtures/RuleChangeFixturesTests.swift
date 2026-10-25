// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import Testing

/// SEMANTICS.md §8: `effectiveRuleSet` against every `rule-change` fixture (rules compared as a set by id).
@Suite("rule-change fixtures")
struct RuleChangeFixturesTests {
    private func rulesAsSet(_ ruleset: Ruleset) -> Ruleset {
        var sorted = ruleset
        sorted.rules.sort { $0.id.utf16.lexicographicallyPrecedes($1.id.utf16) }
        return sorted
    }

    @Test("rule-change", arguments: try FixtureLoader.load("rule-change"))
    func ruleChange(_ fixture: Fixture) throws {
        let parsed = try fixture.decode(RuleChangeFixture.self)
        let given = parsed.given
        let result = try effectiveRuleSet(
            old: given.old,
            new: given.new,
            now: given.now,
            pendingEffectiveFrom: given.pendingEffectiveFrom,
            catalog: try RulesPackage.catalog()
        )
        #expect(result.effectiveFrom == parsed.then.effectiveFrom)
        #expect(rulesAsSet(result.effectiveToday) == rulesAsSet(parsed.then.effectiveToday))
    }
}
