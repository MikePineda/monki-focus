// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import Testing

@Suite("AFK detector")
struct AfkDetectorTests {
    private static let now = CaptureSamples.origin + 1_000

    @Test("recent input is not-afk observed at the last input")
    func recentInputIsNotAfkObservedAtTheLastInput() {
        var detector = AfkDetector()

        let observation = detector.sample(secondsSinceInput: 3.7, at: Self.now)

        #expect(observation == AfkObservation(status: .notAfk, at: Self.now - 3, isTransition: true))
    }

    @Test("idle for the threshold becomes afk dated back to the last input")
    func idleForTheThresholdBecomesAfkDatedBackToTheLastInput() {
        var detector = AfkDetector()
        _ = detector.sample(secondsSinceInput: 175, at: Self.now - 5)

        let observation = detector.sample(secondsSinceInput: 180, at: Self.now)

        #expect(observation == AfkObservation(status: .afk, at: Self.now - 180, isTransition: true))
    }

    @Test("staying idle extends afk to now")
    func stayingIdleExtendsAfkToNow() {
        var detector = AfkDetector()
        _ = detector.sample(secondsSinceInput: 200, at: Self.now - 5)

        let observation = detector.sample(secondsSinceInput: 205, at: Self.now)

        #expect(observation == AfkObservation(status: .afk, at: Self.now, isTransition: false))
    }

    @Test("idle just under the threshold is not afk")
    func idleJustUnderTheThresholdIsNotAfk() {
        var detector = AfkDetector()

        #expect(detector.sample(secondsSinceInput: 179.9, at: Self.now).status == .notAfk)
    }

    @Test(
        "sleep, display sleep, lock and another session force afk at once",
        arguments: SessionEvent.allCases.filter(\.engagesReason))
    func sleepDisplaySleepLockAndAnotherSessionForceAfkAtOnce(event: SessionEvent) {
        var detector = AfkDetector()
        _ = detector.sample(secondsSinceInput: 1, at: Self.now - 1)

        let observation = detector.handle(event, secondsSinceInput: 0, at: Self.now)

        #expect(observation == AfkObservation(status: .afk, at: Self.now, isTransition: true))
        #expect(detector.isForcedAway)
    }

    @Test("forced afk ignores fresh input until the reason is released")
    func forcedAfkIgnoresFreshInputUntilTheReasonIsReleased() {
        var detector = AfkDetector()
        _ = detector.handle(.screenLocked, secondsSinceInput: 0, at: Self.now)

        #expect(detector.sample(secondsSinceInput: 0, at: Self.now + 5).status == .afk)
        let unlocked = detector.handle(.screenUnlocked, secondsSinceInput: 1, at: Self.now + 30)
        #expect(unlocked == AfkObservation(status: .notAfk, at: Self.now + 29, isTransition: true))
    }

    @Test("wake resumes only after every engaged reason is released")
    func wakeResumesOnlyAfterEveryEngagedReasonIsReleased() {
        var detector = AfkDetector()
        _ = detector.handle(.screensDidSleep, secondsSinceInput: 0, at: Self.now)
        _ = detector.handle(.systemWillSleep, secondsSinceInput: 0, at: Self.now + 1)

        #expect(detector.handle(.systemDidWake, secondsSinceInput: 0, at: Self.now + 600).status == .afk)
        #expect(detector.handle(.screensDidWake, secondsSinceInput: 0, at: Self.now + 601).status == .notAfk)
        #expect(detector.isForcedAway == false)
    }

    @Test("waking without input since before sleep stays afk")
    func wakingWithoutInputSinceBeforeSleepStaysAfk() {
        var detector = AfkDetector()
        _ = detector.handle(.systemWillSleep, secondsSinceInput: 2, at: Self.now)

        let woke = detector.handle(.systemDidWake, secondsSinceInput: 3_600, at: Self.now + 3_600)

        #expect(woke == AfkObservation(status: .afk, at: Self.now + 3_600, isTransition: false))
    }

    @Test("every wake or unlock releases the reason its sleep or lock engaged")
    func everyWakeOrUnlockReleasesTheReasonItsSleepOrLockEngaged() {
        let releases = SessionEvent.allCases.filter { !$0.engagesReason }
        let engagedByRelease = Set(releases.map(\.reason))

        #expect(engagedByRelease == Set(AwayReason.allCases).subtracting([.poweringOff]))
        #expect(SessionEvent.allCases.filter(\.requiresFlush) == SessionEvent.allCases.filter(\.engagesReason))
    }
}
