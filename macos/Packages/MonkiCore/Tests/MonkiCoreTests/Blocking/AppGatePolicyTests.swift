// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import Testing

/// What the Mac does with an app that comes to the front: the shared engine
/// decides with `target.kind = app` and the policy turns the decision into
/// allow, gate, block or bedtime. The app itself, the system apps needed to
/// leave and the user's allowlist are never hidden.
@Suite("app gate policy")
struct AppGatePolicyTests {
    private static let games = "com.example.games"
    private static let chat = "com.example.chat"
    private static let editor = "com.example.editor"
    private static let catalog = RulesCatalog(siteProfiles: [], surfaces: [], defaultCategories: [])
    private static let policy = AppGatePolicy(protectedApps: ProtectedApps(ownBundleId: "dev.monkifocus.mac"))

    private static func ruleset(bedtimeEnabled: Bool = false) -> Ruleset {
        Ruleset(
            revision: 1,
            updatedAt: "2026-10-01T00:00:00Z",
            timeZone: "UTC",
            rules: [
                Rule(id: "r-games", target: .app(package: games), mode: .friction),
                Rule(id: "r-chat", target: .app(package: chat), mode: .block),
            ],
            categories: [CategoryAssignment(target: .app(package: games), level: 10, category: "games")],
            bedtime: Bedtime(
                enabled: bedtimeEnabled,
                days: Weekday.allCases,
                start: TimeOfDay(hour: 22, minute: 30),
                end: TimeOfDay(hour: 7, minute: 0),
                warnMinutesBefore: 30
            ),
            workHours: Schedule(
                days: [.mon], start: TimeOfDay(hour: 9, minute: 0), end: TimeOfDay(hour: 17, minute: 0))
        )
    }

    private static let afternoon = "2026-10-26T15:00:00Z"
    private static let night = "2026-10-26T23:00:00Z"

    private func action(
        _ bundleId: String?,
        ruleset: Ruleset = ruleset(),
        now: String = afternoon,
        state: DecisionState = DecisionState(),
        overrides: EmergencyOverridePolicy = EmergencyOverridePolicy(),
        policy: AppGatePolicy = policy
    ) -> AppGateAction {
        let decision = bundleId.map {
            decide(ruleset, observation: policy.observation(for: $0), state: state, now: now, catalog: Self.catalog)
        }
        return policy.action(bundleId: bundleId, decision: decision, overrides: overrides, at: .seconds(10))
    }

    @Test("an app is observed as an app without a surface")
    func anAppIsObservedAsAnAppWithoutASurface() {
        #expect(Self.policy.observation(for: Self.games) == .app(package: Self.games, surface: nil))
    }

    @Test("an app without a rule is allowed")
    func anAppWithoutARuleIsAllowed() {
        #expect(action(Self.editor) == .allow)
    }

    @Test("a friction app is gated with the engine's gate and its rule as the group")
    func aFrictionAppIsGatedWithTheEnginesGateAndItsRuleAsTheGroup() throws {
        guard case .gate(let group, let gate) = action(Self.games) else {
            Issue.record("expected a gate")
            return
        }
        #expect(group == "r-games")
        #expect(gate.level == 0)
        #expect(gate.pauseSeconds == 5)
    }

    @Test("a blocked app is blocked with its rule as the group")
    func aBlockedAppIsBlockedWithItsRuleAsTheGroup() {
        #expect(action(Self.chat) == .block(group: "r-chat", reason: .ruleMatch))
    }

    @Test("an active intention lets a friction app through")
    func anActiveIntentionLetsAFrictionAppThrough() throws {
        var state = initialEscalationState("r-games")
        state.phase = .active
        state.intentionExpiresAt = "2026-10-26T15:10:00Z"

        #expect(action(Self.games, state: DecisionState(escalation: [state])) == .allow)
    }

    @Test("during bedtime a low-level app gets the bedtime screen")
    func duringBedtimeALowLevelAppGetsTheBedtimeScreen() {
        #expect(action(Self.games, ruleset: Self.ruleset(bedtimeEnabled: true), now: Self.night) == .bedtime)
    }

    @Test("during bedtime an uncategorised app stays allowed")
    func duringBedtimeAnUncategorisedAppStaysAllowed() {
        #expect(action(Self.editor, ruleset: Self.ruleset(bedtimeEnabled: true), now: Self.night) == .allow)
    }

    @Test("a granted emergency override lifts its own group")
    func aGrantedEmergencyOverrideLiftsItsOwnGroup() {
        var overrides = EmergencyOverridePolicy()
        overrides.request("r-chat", at: .zero)
        _ = overrides.advance(to: .seconds(0) + EmergencyOverridePolicy.waitDuration)

        #expect(action(Self.chat, overrides: overrides) == .allow)
        #expect(action(Self.games, overrides: overrides) != .allow)
    }

    @Test("a waiting emergency override lifts nothing yet")
    func aWaitingEmergencyOverrideLiftsNothingYet() {
        var overrides = EmergencyOverridePolicy()
        overrides.request("r-chat", at: .zero)

        #expect(action(Self.chat, overrides: overrides) == .block(group: "r-chat", reason: .ruleMatch))
    }

    @Test("a bedtime emergency override lifts bedtime")
    func aBedtimeEmergencyOverrideLiftsBedtime() {
        var overrides = EmergencyOverridePolicy()
        overrides.request("bedtime", at: .zero)
        _ = overrides.advance(to: EmergencyOverridePolicy.waitDuration)

        #expect(
            action(Self.games, ruleset: Self.ruleset(bedtimeEnabled: true), now: Self.night, overrides: overrides)
                == .allow)
    }

    @Test(
        "the apps needed to leave are never hidden",
        arguments: [
            "dev.monkifocus.mac", "com.apple.systempreferences", "com.apple.finder", "com.apple.ActivityMonitor",
        ])
    func theAppsNeededToLeaveAreNeverHidden(bundleId: String) {
        let ruleset = Ruleset(
            revision: 1,
            updatedAt: "2026-10-01T00:00:00Z",
            timeZone: "UTC",
            rules: [Rule(id: "r-x", target: .app(package: bundleId), mode: .block)],
            categories: [],
            bedtime: Self.ruleset().bedtime,
            workHours: Self.ruleset().workHours
        )

        #expect(action(bundleId, ruleset: ruleset) == .allow)
    }

    @Test("the user's allowlist is never hidden")
    func theUsersAllowlistIsNeverHidden() {
        let policy = AppGatePolicy(
            protectedApps: ProtectedApps(ownBundleId: "dev.monkifocus.mac", allowlist: [Self.chat]))

        #expect(action(Self.chat, policy: policy) == .allow)
    }

    @Test("an app without a bundle id is left alone")
    func anAppWithoutABundleIdIsLeftAlone() {
        #expect(action(nil) == .allow)
    }

    @Test("an engine error blocks without a group, so only closing is offered")
    func anEngineErrorBlocksWithoutAGroupSoOnlyClosingIsOffered() {
        #expect(action(Self.editor, now: "not an instant") == .block(group: nil, reason: .engineError))
    }

    @Test("the escalation group follows the extension: the rule, else bedtime")
    func theEscalationGroupFollowsTheExtensionTheRuleElseBedtime() {
        let bedtime = Decision(
            access: .block, content: .show, ruleId: nil, reason: .scheduleBedtime,
            explanationKey: .scheduleBedtime, validUntil: nil)

        #expect(AppGatePolicy.group(of: bedtime) == "bedtime")
        #expect(AppGatePolicy.group(of: .engineError) == nil)
    }
}
