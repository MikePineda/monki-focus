// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import Testing

@testable import MonkiCore

/// SEMANTICS.md §6.4, §5.2 step 4, §7.4 and §8: what the shared
/// `relaxed_*` fixtures do not pin down on their own.
@Suite("relaxed weekends")
struct RelaxedWeekendsTests {
    private static let rulesetText = """
        {"schemaVersion":1,"revision":1,"updatedAt":"2026-10-01T00:00:00Z","timeZone":"Australia/Sydney",\
        "rules":[],"categories":[],"bedtime":{"enabled":true,"days":["mon","tue","wed","thu","fri","sat","sun"],\
        "start":"22:30","end":"07:00","warnMinutesBefore":30},\
        "workHours":{"days":["mon"],"start":"09:00","end":"17:30"}RELAXED}
        """

    private func rulesetText(relaxed: String) -> String {
        Self.rulesetText.replacingOccurrences(of: "RELAXED", with: relaxed)
    }

    private func ruleset(relaxed: Bool?, rules: [Rule] = []) throws -> Ruleset {
        let field = relaxed.map { #","relaxedWeekends":{"enabled":\#($0)}"# } ?? ""
        var ruleset = try StrictJSONDecoder().decode(Ruleset.self, from: Data(rulesetText(relaxed: field).utf8))
        ruleset.rules = rules
        return ruleset
    }

    private static let instagramPost = Observation.site(urlText: "https://www.instagram.com/p/abc123")
    private static let fridayNight = "2026-10-30T23:00:00+11:00"
    private static let instagramFriction = Rule(
        id: "r-instagram-friction",
        target: .site(domain: "instagram.com", path: nil),
        mode: .friction
    )

    private func escalation(_ group: String, phase: EscalationPhase, attempts: Int, gate: Gate? = nil)
        -> EscalationState
    {
        EscalationState(
            targetGroup: group,
            phase: phase,
            attemptCount: attempts,
            lastAttemptAt: "2026-10-30T11:55:00Z",
            lastActivityAt: "2026-10-30T11:55:00Z",
            brokenCount: 0,
            lastFrictionType: .countdown,
            gate: gate,
            pauseEndsAt: phase == .pausing ? "2026-10-30T12:05:00Z" : nil,
            pendingExtension: false,
            intentionExpiresAt: nil,
            overrideReadyAt: nil,
            overrideEndsAt: nil
        )
    }

    private func decideAt(_ ruleset: Ruleset, escalation: [EscalationState]) throws -> Decision {
        decide(
            ruleset,
            observation: Self.instagramPost,
            state: DecisionState(escalation: escalation, usage: nil, unlocks: [], guardianLinked: false),
            now: Self.fridayNight,
            catalog: try RulesPackage.catalog()
        )
    }

    @Test("the validator accepts relaxed weekends on or off and a rule set without them")
    func theValidatorAcceptsRelaxedWeekendsOnOrOffAndARuleSetWithoutThem() throws {
        let validator = try RulesPackage.validator()
        for field in ["", #","relaxedWeekends":{"enabled":true}"#, #","relaxedWeekends":{"enabled":false}"#] {
            #expect(validator.validateDocument(schema: "ruleset", text: rulesetText(relaxed: field)) == .valid)
        }
    }

    @Test("the validator rejects an unknown field or a missing enabled inside relaxed weekends")
    func theValidatorRejectsAnUnknownFieldOrAMissingEnabledInsideRelaxedWeekends() throws {
        let validator = try RulesPackage.validator()
        for field in [#","relaxedWeekends":{"enabled":true,"days":["sat"]}"#, #","relaxedWeekends":{}"#] {
            #expect(validator.validateDocument(schema: "ruleset", text: rulesetText(relaxed: field)).code == .schema)
        }
    }

    @Test("decoding rejects an unknown field inside relaxed weekends")
    func decodingRejectsAnUnknownFieldInsideRelaxedWeekends() {
        let text = rulesetText(relaxed: #","relaxedWeekends":{"enabled":true,"extra":1}"#)
        #expect(throws: (any Error).self) { try StrictJSONDecoder().decode(Ruleset.self, from: Data(text.utf8)) }
    }

    @Test("a rule set without relaxed weekends encodes without the field")
    func aRuleSetWithoutRelaxedWeekendsEncodesWithoutTheField() throws {
        let absent = try JSONEncoder().encode(try ruleset(relaxed: nil))
        #expect(!String(decoding: absent, as: UTF8.self).contains("relaxedWeekends"))
        let present = try ruleset(relaxed: true)
        #expect(try StrictJSONDecoder().decode(Ruleset.self, from: JSONEncoder().encode(present)) == present)
    }

    @Test("the registry marks only reels and shorts as short video")
    func theRegistryMarksOnlyReelsAndShortsAsShortVideo() throws {
        let catalog = try RulesPackage.catalog()
        #expect(catalog.isShortVideo("instagram.reels"))
        #expect(catalog.isShortVideo("youtube.shorts"))
        #expect(!catalog.isShortVideo("instagram.explore"))
        #expect(!catalog.isShortVideo("youtube.watch"))
        #expect(!catalog.isShortVideo("unknown.surface"))
    }

    @Test("a surface without short video decodes as not short video")
    func aSurfaceWithoutShortVideoDecodesAsNotShortVideo() throws {
        let surface = try StrictJSONDecoder().decode(
            Surface.self, from: Data(#"{"id":"x.feed","family":"x","kind":"feed"}"#.utf8))
        #expect(!surface.shortVideo)
        #expect(!String(decoding: try JSONEncoder().encode(surface), as: UTF8.self).contains("shortVideo"))
    }

    @Test("the relaxed bedtime gate counts only the bedtime group")
    func theRelaxedBedtimeGateCountsOnlyTheBedtimeGroup() throws {
        let ruleset = try ruleset(relaxed: true, rules: [Self.instagramFriction])
        let fresh = try decideAt(ruleset, escalation: [])
        let busyRule = try decideAt(
            ruleset, escalation: [escalation(Self.instagramFriction.id, phase: .idle, attempts: 4)])

        #expect(fresh.access == .gate)
        #expect(fresh.reason == .intentionRequired)
        #expect(fresh.ruleId == nil)
        #expect(busyRule.gate == fresh.gate)
    }

    @Test("a pausing bedtime group returns its stored gate on a relaxed night")
    func aPausingBedtimeGroupReturnsItsStoredGateOnARelaxedNight() throws {
        let stored = Gate(
            level: 2, pauseSeconds: 60, frictionType: .breath, requiresTypedIntention: true,
            requiresGuardianKey: false)
        let decision = try decideAt(
            try ruleset(relaxed: true),
            escalation: [escalation(bedtimeGroup, phase: .pausing, attempts: 3, gate: stored)]
        )
        #expect(decision.access == .gate)
        #expect(decision.gate == stored)
    }

    @Test("an emergency override of the bedtime group lifts the relaxed bedtime")
    func anEmergencyOverrideOfTheBedtimeGroupLiftsTheRelaxedBedtime() throws {
        var override = escalation(bedtimeGroup, phase: .overrideActive, attempts: 0)
        override.overrideEndsAt = "2026-10-30T12:30:00Z"
        let decision = try decideAt(try ruleset(relaxed: true), escalation: [override])
        #expect(decision.access == .allow)
        #expect(decision.reason == .emergencyActive)
    }

    @Test("turning relaxed weekends on waits and anything else tightens")
    func turningRelaxedWeekendsOnWaitsAndAnythingElseTightens() {
        let on = RelaxedWeekends(enabled: true)
        let off = RelaxedWeekends(enabled: false)
        #expect(relaxedWeekendsChangeWaits(nil, on))
        #expect(relaxedWeekendsChangeWaits(off, on))
        #expect(!relaxedWeekendsChangeWaits(on, on))
        #expect(!relaxedWeekendsChangeWaits(on, nil))
        #expect(!relaxedWeekendsChangeWaits(on, off))
        #expect(!relaxedWeekendsChangeWaits(nil, off))
        #expect(!relaxedWeekendsChangeWaits(nil, nil))
    }
}
