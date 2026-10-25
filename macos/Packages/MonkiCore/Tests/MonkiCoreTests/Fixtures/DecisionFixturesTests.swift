// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import Testing

/// SEMANTICS.md §5: every `decision` and `specificity` fixture, with full
/// `Decision` parity (`validUntil` included), plus the adapter contract of
/// §7.4 and §5.2.2 checked on each: the friction candidates name the gating
/// winner and, combined with `effectiveEscalationState`, make
/// `nextEscalation` store exactly the gate `decide` returned; a spent budget
/// belongs to a rule the activity accrues to.
@Suite("decision and specificity fixtures")
struct DecisionFixturesTests {
    /// Phases in which `decide` shows the stored gate instead of the one a visit would produce (§7.4).
    private static let storedGatePhases: Set<EscalationPhase> = [.pausing, .asking, .timedOut, .overrideWaiting]

    @Test("decision", arguments: try FixtureLoader.load("decision"))
    func decision(_ fixture: Fixture) throws {
        try check(fixture.decode(DecisionFixture.self))
    }

    @Test("specificity", arguments: try FixtureLoader.load("specificity"))
    func specificity(_ fixture: Fixture) throws {
        try check(fixture.decode(DecisionFixture.self))
    }

    private func check(_ fixture: DecisionFixture) throws {
        let catalog = try RulesPackage.catalog()
        let given = fixture.given
        let observation = fixture.when.target
        let decision = decide(
            given.ruleset, observation: observation, state: given.state, now: given.now, catalog: catalog)
        #expect(decision == fixture.then)
        try checkAdapterHelpers(fixture, catalog)
    }

    private func checkAdapterHelpers(_ fixture: DecisionFixture, _ catalog: RulesCatalog) throws {
        let given = fixture.given
        let observation = fixture.when.target
        let then = fixture.then
        if then.reason == .budgetExhausted, let ruleId = then.ruleId {
            #expect(
                budgetedRulesFor(given.ruleset, observation: observation, at: given.now, catalog: catalog).contains(
                    ruleId))
        }
        guard then.access == .gate, let winnerId = then.ruleId else { return }
        let ids = frictionCandidates(given.ruleset, observation: observation, now: given.now, catalog: catalog)
        #expect(ids.contains(winnerId))
        let byId = Dictionary(given.ruleset.rules.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let winner = try #require(byId[winnerId])
        if let own = given.state.escalation.first(where: { $0.targetGroup == winnerId }),
            Self.storedGatePhases.contains(own.phase)
        {
            return
        }
        let effective = try effectiveEscalationState(
            winner: winner,
            frictionRules: ids.compactMap { byId[$0] },
            states: given.state.escalation,
            now: given.now
        )
        let visited = try nextEscalation(
            effective, event: .visit, now: given.now, guardianLinked: given.state.guardianLinked)
        #expect(visited.state.gate == then.gate)
    }
}
