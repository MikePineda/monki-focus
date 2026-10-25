// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import Testing

@testable import MonkiCore

/// Properties of `decide` over seeded random inputs (`DecisionGenerator`);
/// a failure names its seed, which reproduces the case.
@Suite("decision properties")
struct DecisionPropertiesTests {
    private static let runs: [UInt64] = Array(1...300)

    @Test("same inputs give the same decision", arguments: runs)
    func sameInputsGiveTheSameDecision(seed: UInt64) throws {
        var generator = DecisionGenerator(seed: seed)
        let (ruleset, observation, state, now) = (
            generator.ruleset(), generator.observation(), generator.state(), generator.instant()
        )
        let catalog = try RulesPackage.catalog()

        let first = decide(ruleset, observation: observation, state: state, now: now, catalog: catalog)
        let again = decide(ruleset, observation: observation, state: state, now: now, catalog: catalog)
        // A JSON round trip of every input decides the same way too.
        let encoder = JSONEncoder()
        let decoder = StrictJSONDecoder()
        let copied = decide(
            try decoder.decode(Ruleset.self, from: encoder.encode(ruleset)),
            observation: try decoder.decode(Observation.self, from: encoder.encode(observation)),
            state: try decoder.decode(DecisionState.self, from: encoder.encode(state)),
            now: now,
            catalog: catalog
        )

        #expect(first == again, "seed \(seed)")
        #expect(first == copied, "seed \(seed)")
        #expect(first.reason != .engineError, "seed \(seed)")
    }

    @Test("the decision is independent of rule order", arguments: runs)
    func theDecisionIsIndependentOfRuleOrder(seed: UInt64) throws {
        var generator = DecisionGenerator(seed: seed)
        let (ruleset, observation, state, now) = (
            generator.ruleset(), generator.observation(), generator.state(), generator.instant()
        )
        var shuffled = ruleset
        shuffled.rules.shuffle(using: &generator.random)
        shuffled.rules.reverse()
        let catalog = try RulesPackage.catalog()

        #expect(
            decide(ruleset, observation: observation, state: state, now: now, catalog: catalog)
                == decide(shuffled, observation: observation, state: state, now: now, catalog: catalog),
            "seed \(seed)"
        )
        #expect(
            frictionCandidates(ruleset, observation: observation, now: now, catalog: catalog)
                == frictionCandidates(shuffled, observation: observation, now: now, catalog: catalog),
            "seed \(seed)"
        )
        #expect(
            budgetedRulesFor(ruleset, observation: observation, at: now, catalog: catalog)
                == budgetedRulesFor(shuffled, observation: observation, at: now, catalog: catalog),
            "seed \(seed)"
        )
    }

    /// `validUntil` against a brute-force oracle that knows nothing about
    /// schedules, bedtime, midnights or DST: it evaluates the decision at
    /// every whole UTC minute of the next 24 hours (wall-clock rules can only
    /// change at a whole minute in every real zone) and at every instant the
    /// state names, and keeps the first one at which the decision differs.
    @Test("validUntil is the first instant the decision changes", arguments: Array(runs.prefix(120)))
    func validUntilIsTheFirstInstantTheDecisionChanges(seed: UInt64) throws {
        var generator = DecisionGenerator(seed: seed)
        let ruleset = generator.ruleset()
        let observation = generator.observation()
        let now = generator.instantNearTransitions()
        let nowSeconds = try epochSecondsOf(now)
        let pending: String? =
            generator.chance(0.4)
            ? utcInstantOf(nowSeconds + Int.random(in: -3600...(2 * 86_400), using: &generator.random)) : nil
        let state = generator.state(pendingEffectiveFrom: pending)
        let catalog = try RulesPackage.catalog()

        let decision = decide(ruleset, observation: observation, state: state, now: now, catalog: catalog)

        #expect(decision.validUntil == (try oracle(ruleset, observation, state, nowSeconds, catalog)), "seed \(seed)")
    }

    @Test("the decision holds until validUntil", arguments: runs)
    func theDecisionHoldsUntilValidUntil(seed: UInt64) throws {
        var generator = DecisionGenerator(seed: seed)
        let (ruleset, observation, state) = (generator.ruleset(), generator.observation(), generator.state())
        let now = generator.instantNearTransitions()
        let catalog = try RulesPackage.catalog()

        var decision = decide(ruleset, observation: observation, state: state, now: now, catalog: catalog)
        let start = try epochSecondsOf(now)
        let end = try epochSecondsOf(try #require(decision.validUntil))
        let later = start + Int.random(in: 0...max(0, end - start - 1), using: &generator.random)
        var actual = decide(ruleset, observation: observation, state: state, now: utcInstantOf(later), catalog: catalog)
        actual.validUntil = nil
        decision.validUntil = nil

        #expect(end > start, "seed \(seed)")
        #expect(actual == decision, "seed \(seed)")
    }

    private func oracle(
        _ ruleset: Ruleset,
        _ observation: Observation,
        _ state: DecisionState,
        _ nowSeconds: Int,
        _ catalog: RulesCatalog
    ) throws -> String {
        let (inputs, _) = try decisionInputsOf(ruleset, observation, state, now: utcInstantOf(nowSeconds), catalog)
        let first = try decisionAt(inputs, nowSeconds)
        var horizon = nowSeconds + 86_400
        if let pending = state.pendingEffectiveFrom.flatMap({ try? epochSecondsOf($0) }), pending > nowSeconds {
            horizon = min(horizon, pending)
        }
        var candidates = Set(stride(from: (nowSeconds / 60 + 1) * 60, through: horizon, by: 60))
        for unlock in state.unlocks {
            candidates.insert(try epochSecondsOf(unlock.notBefore))
            candidates.insert(try epochSecondsOf(unlock.expiresAt))
        }
        for escalation in state.escalation {
            for instant in [escalation.intentionExpiresAt, escalation.overrideEndsAt].compactMap({ $0 }) {
                candidates.insert(try epochSecondsOf(instant))
            }
            if let lastActivityAt = escalation.lastActivityAt {
                candidates.insert(try epochSecondsOf(lastActivityAt) + 7200)
            }
        }
        candidates.insert(horizon)
        for instant in candidates.filter({ $0 > nowSeconds && $0 <= horizon }).sorted() {
            if try decisionAt(inputs, instant) != first { return utcInstantOf(instant) }
        }
        return utcInstantOf(horizon)
    }
}
