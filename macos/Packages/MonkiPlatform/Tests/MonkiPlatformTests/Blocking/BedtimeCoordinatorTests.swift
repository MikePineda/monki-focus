// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import MonkiPlatform
import Testing

/// Bedtime on the Mac with fake clocks: bedtime runs 01:00–02:00 UTC and is
/// warned from 00:30; the fake time starts at 00:00 UTC.
@MainActor
@Suite("bedtime coordinator")
struct BedtimeCoordinatorTests {
    let time = FakeTime()
    let overlay = RecordingBedtimeOverlay()
    let notifier = CountingBedtimeWarningNotifier()
    let outbox = RecordingBypassOutbox()
    let rules = StaticRulesProvider(SampleRules.ruleset())
    let coordinator: BedtimeCoordinator

    init() {
        let overrides = EmergencyOverrides(
            outbox: outbox, wall: time.wall, monotonic: time.monotonic, newDedupeKey: { "key-1" })
        coordinator = BedtimeCoordinator(
            rules: rules, overrides: overrides, presenter: overlay, notifier: notifier, timers: time, wall: time.wall)
        coordinator.start()
    }

    @Test("the warning is posted once when the lead-up starts")
    func theWarningIsPostedOnceWhenTheLeadUpStarts() {
        time.advance(by: 30 * 60 - 1)
        #expect(notifier.warnings == 0)

        time.advance(by: 10 * 60)

        #expect(notifier.warnings == 1)
        #expect(!overlay.isShowing)
    }

    @Test("every screen is dimmed while bedtime is active and cleared after it")
    func everyScreenIsDimmedWhileBedtimeIsActiveAndClearedAfterIt() {
        time.advance(by: 60 * 60)
        #expect(overlay.isShowing)
        #expect(overlay.shown == [EmergencyStatus.none])

        time.advance(by: 60 * 60)

        #expect(!overlay.isShowing)
    }

    @Test("the bedtime emergency waits two minutes, records a bypass and clears the screens")
    func theBedtimeEmergencyWaitsTwoMinutesRecordsABypassAndClearsTheScreens() {
        time.advance(by: 60 * 60)

        coordinator.requestEmergency()
        #expect(overlay.shown.last == .waiting(remaining: .seconds(120)))
        time.advance(by: 120)

        #expect(outbox.records.first?.details == BypassDetails(scope: .bedtime, waitSeconds: 120, durationSeconds: 900))
        #expect(!overlay.isShowing)
    }

    @Test("the screens dim again when the emergency access ends during bedtime")
    func theScreensDimAgainWhenTheEmergencyAccessEndsDuringBedtime() {
        time.advance(by: 60 * 60)
        coordinator.requestEmergency()
        time.advance(by: 120)

        time.advance(by: 900)

        #expect(overlay.isShowing)
    }

    @Test("cancelling the emergency keeps the screens dimmed and records nothing")
    func cancellingTheEmergencyKeepsTheScreensDimmedAndRecordsNothing() {
        time.advance(by: 60 * 60)
        coordinator.requestEmergency()

        coordinator.cancelEmergency()
        time.advance(by: 300)

        #expect(outbox.records.isEmpty)
        #expect(overlay.isShowing)
        #expect(overlay.shown.last == EmergencyStatus.none)
    }

    @Test("a disabled bedtime never dims nor warns")
    func aDisabledBedtimeNeverDimsNorWarns() {
        rules.current?.ruleset = SampleRules.ruleset(bedtimeEnabled: false)

        time.advance(by: 90 * 60)

        #expect(notifier.warnings == 0)
        #expect(overlay.shown.isEmpty)
    }

    @Test("an unresolvable zone never dims the screens")
    func anUnresolvableZoneNeverDimsTheScreens() {
        rules.current?.ruleset = SampleRules.ruleset(timeZone: "Nowhere/Unknown")

        time.advance(by: 90 * 60)

        #expect(overlay.shown.isEmpty)
    }

    @Test("stopping removes the overlay")
    func stoppingRemovesTheOverlay() {
        time.advance(by: 60 * 60)

        coordinator.stop()

        #expect(!overlay.isShowing)
    }
}
