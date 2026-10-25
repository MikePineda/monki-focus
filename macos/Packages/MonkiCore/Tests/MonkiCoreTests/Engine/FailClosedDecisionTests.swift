// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import Testing

/// SEMANTICS.md §14: invalid input never opens anything. `decide` blocks and
/// hides the feed without a gate or validity, `frictionCandidates` returns
/// nothing and `budgetedRulesFor` counts every enabled budget.
@Suite("fail-closed decision")
struct FailClosedDecisionTests {
    private static let rules = [
        Rule(id: "r-friction", target: .site(domain: "reddit.com", path: nil), mode: .friction, dailyBudgetMinutes: 10),
        Rule(
            id: "r-off", target: .site(domain: "x.com", path: nil), mode: .block, dailyBudgetMinutes: 5, enabled: false),
        Rule(id: "r-budget", target: .site(domain: "youtube.com", path: nil), mode: .allow, dailyBudgetMinutes: 30),
    ]

    private func ruleset(timeZone: String = "Australia/Sydney") -> Ruleset {
        Ruleset(
            revision: 1,
            updatedAt: "2026-10-01T00:00:00Z",
            timeZone: timeZone,
            rules: Self.rules,
            categories: [],
            bedtime: Bedtime(
                enabled: false,
                days: [.mon],
                start: TimeOfDay(hour: 22, minute: 30),
                end: TimeOfDay(hour: 7, minute: 0),
                warnMinutesBefore: 30
            ),
            workHours: Schedule(
                days: [.mon], start: TimeOfDay(hour: 9, minute: 0), end: TimeOfDay(hour: 17, minute: 30))
        )
    }

    private static let reddit = Observation.site(urlText: "https://www.reddit.com/")
    private static let now = "2026-10-26T10:00:00+11:00"

    private func expectFailClosed(
        _ ruleset: Ruleset,
        _ observation: Observation,
        _ state: DecisionState,
        _ now: String,
        helpersRead: Bool = true
    ) throws {
        let catalog = try RulesPackage.catalog()
        let decision = decide(ruleset, observation: observation, state: state, now: now, catalog: catalog)
        #expect(decision == .engineError)
        #expect(decision.gate == nil && decision.validUntil == nil && decision.ruleId == nil)
        // The adapter helpers take no state, so only inputs they read make them fail closed.
        guard helpersRead else { return }
        #expect(frictionCandidates(ruleset, observation: observation, now: now, catalog: catalog).isEmpty)
        #expect(
            budgetedRulesFor(ruleset, observation: observation, at: now, catalog: catalog) == [
                "r-budget", "r-friction",
            ])
    }

    @Test("the valid inputs decide normally")
    func theValidInputsDecideNormally() throws {
        let catalog = try RulesPackage.catalog()
        let decision = decide(
            ruleset(), observation: Self.reddit, state: DecisionState(), now: Self.now, catalog: catalog)
        #expect(decision.access == .gate)
        #expect(
            frictionCandidates(ruleset(), observation: Self.reddit, now: Self.now, catalog: catalog) == ["r-friction"])
    }

    @Test("an instant without an offset fails closed")
    func anInstantWithoutAnOffsetFailsClosed() throws {
        try expectFailClosed(ruleset(), Self.reddit, DecisionState(), "2026-10-26T10:00:00")
    }

    @Test("an unresolvable time zone fails closed")
    func anUnresolvableTimeZoneFailsClosed() throws {
        try expectFailClosed(ruleset(timeZone: "Mars/Olympus"), Self.reddit, DecisionState(), Self.now)
        var pending = ruleset()
        pending.pendingTimeZone = "Mars/Olympus"
        try expectFailClosed(pending, Self.reddit, DecisionState(), Self.now)
    }

    @Test(
        "a schema-invalid observation fails closed",
        arguments: [
            Observation.site(urlText: ""),
            Observation.site(urlText: String(repeating: "a", count: 2049)),
            Observation.app(package: "not a package", surface: nil),
            Observation.app(package: "com.example.reader", surface: "Not.A.Surface"),
        ])
    func aSchemaInvalidObservationFailsClosed(observation: Observation) throws {
        try expectFailClosed(ruleset(), observation, DecisionState(), Self.now)
    }

    @Test("an invalid instant anywhere in the state fails closed")
    func anInvalidInstantAnywhereInTheStateFailsClosed() throws {
        var escalation = initialEscalationState("r-other")
        escalation.overrideReadyAt = "yesterday"
        try expectFailClosed(
            ruleset(), Self.reddit, DecisionState(escalation: [escalation]), Self.now, helpersRead: false)
        let unlock = VerifiedUnlock(
            target: .site(domain: "x.com", path: nil), notBefore: "2026-10-25T00:00:00", expiresAt: Self.now)
        try expectFailClosed(ruleset(), Self.reddit, DecisionState(unlocks: [unlock]), Self.now, helpersRead: false)
        try expectFailClosed(
            ruleset(), Self.reddit, DecisionState(pendingEffectiveFrom: "soon"), Self.now, helpersRead: false)
    }

    @Test("garbage url text matches no rule instead of failing")
    func garbageUrlTextMatchesNoRuleInsteadOfFailing() throws {
        let catalog = try RulesPackage.catalog()
        let decision = decide(
            ruleset(),
            observation: .site(urlText: "chrome://settings"),
            state: DecisionState(),
            now: Self.now,
            catalog: catalog
        )
        #expect(decision.reason == .noRule)
        #expect(decision.access == .allow)
    }
}
