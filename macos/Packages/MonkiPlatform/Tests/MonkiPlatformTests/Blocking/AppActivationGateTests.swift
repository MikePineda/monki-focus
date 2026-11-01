// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import MonkiPlatform
import Testing

/// App blocking end to end with fake activations, a fake app control, a
/// recording panel and fake clocks.
@MainActor
@Suite("app activation gate")
struct AppActivationGateTests {
    let time = FakeTime()
    let activations = FakeApplicationActivationSource()
    let control = RecordingApplicationControl()
    let presenter = RecordingGatePresenter()
    let outbox = RecordingBypassOutbox()
    let rules = StaticRulesProvider(SampleRules.ruleset(bedtimeEnabled: false))
    let overrides: EmergencyOverrides
    let gate: AppActivationGate

    init() {
        overrides = EmergencyOverrides(
            outbox: outbox, wall: time.wall, monotonic: time.monotonic, newDedupeKey: { "key-1" })
        gate = AppActivationGate(
            .init(
                sources: [activations],
                control: control,
                presenter: presenter,
                rules: rules,
                overrides: overrides,
                escalation: EscalationBook(),
                timers: time,
                wall: time.wall,
                policy: AppGatePolicy(protectedApps: ProtectedApps(ownBundleId: "dev.monkifocus.mac"))
            ))
        gate.start()
    }

    @Test("an app without a rule is never hidden")
    func anAppWithoutARuleIsNeverHidden() {
        activations.activate(SampleApps.editor)

        #expect(control.hidden.isEmpty)
        #expect(presenter.shown.isEmpty)
    }

    @Test("without rules on this Mac nothing is hidden")
    func withoutRulesOnThisMacNothingIsHidden() {
        rules.current = nil

        activations.activate(SampleRules.chat)

        #expect(control.hidden.isEmpty)
    }

    @Test("a friction app is hidden and the panel starts the pause")
    func aFrictionAppIsHiddenAndThePanelStartsThePause() {
        activations.activate(SampleRules.games)

        #expect(control.hidden == [201])
        #expect(presenter.last?.mode == .pausing(remainingSeconds: 5, totalSeconds: 5))
        #expect(presenter.last?.level == 0)
        #expect(presenter.last?.emergencyAvailable == true)
    }

    @Test("after the pause the panel asks for the intention")
    func afterThePauseThePanelAsksForTheIntention() {
        activations.activate(SampleRules.games)

        time.advance(by: 5)

        guard case .asking = presenter.last?.mode else {
            Issue.record("expected the intention step")
            return
        }
    }

    @Test("reopening the app during the pause never restarts it")
    func reopeningTheAppDuringThePauseNeverRestartsIt() {
        activations.activate(SampleRules.games)
        time.advance(by: 3)

        activations.activate(SampleRules.games)

        #expect(presenter.last?.mode == .pausing(remainingSeconds: 2, totalSeconds: 5))
    }

    @Test("a committed intention brings the app back until it expires")
    func aCommittedIntentionBringsTheAppBackUntilItExpires() {
        activations.activate(SampleRules.games)
        time.advance(by: 5)

        let accepted = gate.commit(intention: "", minutes: 5)

        #expect(accepted)
        #expect(control.activated == [201])
        #expect(!presenter.isShowing)
        activations.activate(SampleRules.games)
        #expect(control.hidden == [201])
        time.advance(by: 5 * 60)
        #expect(control.hidden == [201, 201])
    }

    @Test("an intention cannot be committed during the pause or for other minutes")
    func anIntentionCannotBeCommittedDuringThePauseOrForOtherMinutes() {
        activations.activate(SampleRules.games)

        #expect(!gate.commit(intention: "", minutes: 5))
        time.advance(by: 5)
        #expect(!gate.commit(intention: "", minutes: 7))
        #expect(control.activated.isEmpty)
    }

    @Test("closing leaves the app hidden and closes the panel")
    func closingLeavesTheAppHiddenAndClosesThePanel() {
        activations.activate(SampleRules.games)

        gate.close()

        #expect(!presenter.isShowing)
        #expect(control.activated.isEmpty)
    }

    @Test("a blocked app is hidden and the panel offers the emergency override")
    func aBlockedAppIsHiddenAndThePanelOffersTheEmergencyOverride() {
        activations.activate(SampleRules.chat)

        #expect(control.hidden == [202])
        #expect(presenter.last?.mode == .blocked(reason: .ruleMatch))
        #expect(presenter.last?.emergencyAvailable == true)
    }

    @Test("an emergency override waits two minutes, records a bypass, then brings the app back")
    func anEmergencyOverrideWaitsTwoMinutesRecordsABypassThenBringsTheAppBack() {
        activations.activate(SampleRules.chat)

        gate.requestEmergency()
        time.advance(by: 119)
        #expect(outbox.records.isEmpty)
        #expect(control.activated.isEmpty)
        #expect(presenter.last?.emergency == .waiting(remaining: .seconds(1)))

        time.advance(by: 1)

        #expect(outbox.records.map(\.kind) == [.emergencyOverride])
        #expect(outbox.records.first?.details == BypassDetails(scope: .rule, waitSeconds: 120, durationSeconds: 900))
        #expect(control.activated == [202])
        #expect(!presenter.isShowing)
    }

    @Test("the override lasts fifteen minutes on the monotonic clock whatever the wall clock does")
    func theOverrideLastsFifteenMinutesOnTheMonotonicClockWhateverTheWallClockDoes() {
        activations.activate(SampleRules.chat)
        gate.requestEmergency()
        time.advance(by: 120)

        time.setWall(by: -3_600)
        activations.activate(SampleRules.chat)
        #expect(control.hidden == [202])
        time.advance(by: 899)
        #expect(control.hidden == [202])

        time.advance(by: 1)

        #expect(control.hidden == [202, 202])
        #expect(presenter.last?.mode == .blocked(reason: .ruleMatch))
    }

    @Test("moving the wall clock forward never shortens the wait")
    func movingTheWallClockForwardNeverShortensTheWait() {
        activations.activate(SampleRules.chat)
        gate.requestEmergency()

        time.setWall(by: 3_600)
        time.advance(by: 60)

        #expect(outbox.records.isEmpty)
        #expect(control.activated.isEmpty)
    }

    @Test("the bypass is granted even when the outbox cannot record it")
    func theBypassIsGrantedEvenWhenTheOutboxCannotRecordIt() {
        outbox.failing = true
        activations.activate(SampleRules.chat)
        gate.requestEmergency()

        time.advance(by: 120)

        #expect(control.activated == [202])
    }

    @Test("cancelling the emergency keeps the app hidden")
    func cancellingTheEmergencyKeepsTheAppHidden() {
        activations.activate(SampleRules.chat)
        gate.requestEmergency()

        gate.cancelEmergency()
        time.advance(by: 200)

        #expect(outbox.records.isEmpty)
        #expect(control.activated.isEmpty)
        #expect(presenter.last?.emergency == EmergencyStatus.none)
    }

    @Test("monki-focus itself is never hidden, even with a rule on it")
    func monkiFocusItselfIsNeverHiddenEvenWithARuleOnIt() {
        var ruleset = SampleRules.ruleset(bedtimeEnabled: false)
        ruleset.rules.append(Rule(id: "r-own", target: .app(package: "dev.monkifocus.mac"), mode: .block))
        rules.current?.ruleset = ruleset

        activations.activate(SampleRules.own)

        #expect(control.hidden.isEmpty)
    }

    @Test("bedtime hides a low-level app without the gate panel")
    func bedtimeHidesALowLevelAppWithoutTheGatePanel() {
        rules.current?.ruleset = SampleRules.ruleset(bedtimeEnabled: true)
        time.advance(by: 3_600)

        activations.activate(SampleRules.games)

        #expect(control.hidden == [201])
        #expect(!presenter.isShowing)
    }

    @Test("an app in front when bedtime starts is hidden")
    func anAppInFrontWhenBedtimeStartsIsHidden() {
        rules.current?.ruleset = SampleRules.ruleset(bedtimeEnabled: true)
        activations.frontmostApplication = SampleRules.games
        time.advance(by: 3_599)
        #expect(control.hidden.isEmpty == false)  // gated as friction before bedtime
        let before = control.hidden.count
        gate.close()
        activations.frontmostApplication = SampleRules.games

        time.advance(by: 1)

        #expect(control.hidden.count == before + 1)
        #expect(!presenter.isShowing)
    }
}
