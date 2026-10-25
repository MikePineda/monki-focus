// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import MonkiCoreTesting
import MonkiPlatform
import Testing

/// The whole capture flow on fakes: fake notifications, a fake idle time,
/// fake clocks and timers, and the GRDB store on an in-memory database.
@MainActor
@Suite("activity capture")
struct ActivityCaptureTests {
    private typealias E = SampleEvents

    private let time = FakeTime()
    private let sessions = FakeSessionEventSource()
    private let activations = FakeApplicationActivationSource(frontmost: SampleApps.editor)
    private let titles = FakeWindowTitleSource()
    private let setting = FakeWindowTitleSetting(titlesEnabled: false)
    private let accessibility = FakeAccessibilityTrust(trusted: false)
    private let idle: FakeIdleTimeSource
    private let store: RecordingEventStore

    init() throws {
        idle = FakeIdleTimeSource(time: time)
        store = try RecordingEventStore()
    }

    private func capture() throws -> ActivityCapture {
        try ActivityCapture(
            ActivityCapture.Dependencies(
                sessions: sessions, activations: activations, titles: titles, accessibility: accessibility,
                titleSetting: setting, idle: idle, timers: time, store: store,
                appNames: AppNameStore(database: store.database), wall: time.wall, monotonic: time.monotonic,
                hostname: "test-host", deviceId: "device-a"))
    }

    private func windowEvents(_ capture: ActivityCapture) throws -> [ActivityEvent] {
        try store.events(capture.windowBucket.id)
    }

    private func afkEvents(_ capture: ActivityCapture) throws -> [ActivityEvent] {
        try store.events(capture.afkBucket.id)
    }

    /// Moves time forward while the user keeps typing.
    private func work(_ seconds: Int) {
        for _ in 0..<seconds {
            time.advance(by: 1)
            idle.input()
        }
    }

    @Test("it registers the window and afk buckets")
    func itRegistersTheWindowAndAfkBuckets() throws {
        let capture = try capture()

        #expect(try store.store.buckets().map(\.id) == ["monki-afk_test-host", "monki-window_test-host"])
        #expect(capture.windowBucket.client == "monki-focus-mac")
    }

    @Test("app switches become touching window events written every 10 seconds")
    func appSwitchesBecomeTouchingWindowEventsWrittenEvery10Seconds() throws {
        let capture = try capture()
        capture.start()
        work(12)
        activations.activate(SampleApps.browser)
        work(8)

        #expect(
            try windowEvents(capture) == [
                E.event(0, 12, E.window(SampleApps.editor)), E.event(12, 8, E.window(SampleApps.browser)),
            ])
        #expect(try AppNameStore(database: store.database).name(of: "org.example.Browser") == "Browser")
    }

    @Test("sleep forces afk, ends the window event and flushes before the Mac sleeps")
    func sleepForcesAfkEndsTheWindowEventAndFlushesBeforeTheMacSleeps() throws {
        let capture = try capture()
        capture.start()
        work(7)

        sessions.send(.systemWillSleep)

        #expect(try windowEvents(capture) == [E.event(0, 7, E.window(SampleApps.editor))])
        #expect(try afkEvents(capture) == [E.event(0, 7, .afk(.notAfk)), E.event(7, 0, .afk(.afk))])
        #expect(capture.queue.hasPendingWrites == false)
    }

    @Test("waking resumes capture and the afk event covers the whole sleep")
    func wakingResumesCaptureAndTheAfkEventCoversTheWholeSleep() throws {
        let capture = try capture()
        capture.start()
        work(7)
        sessions.send(.systemWillSleep)
        time.sleep(for: 3_600)
        idle.input()

        sessions.send(.systemDidWake)
        work(10)
        capture.stop()

        #expect(
            try windowEvents(capture) == [
                E.event(0, 7, E.window(SampleApps.editor)), E.event(3_607, 10, E.window(SampleApps.editor)),
            ])
        #expect(try afkEvents(capture).prefix(2) == [E.event(0, 7, .afk(.notAfk)), E.event(7, 3_600, .afk(.afk))])
    }

    @Test("locking the screen pauses window capture until unlock")
    func lockingTheScreenPausesWindowCaptureUntilUnlock() throws {
        let capture = try capture()
        capture.start()
        work(5)
        sessions.send(.screenLocked)
        time.advance(by: 300)
        activations.activate(SampleApps.browser)
        idle.input()

        sessions.send(.screenUnlocked)
        work(10)
        capture.stop()

        #expect(
            try windowEvents(capture) == [
                E.event(0, 5, E.window(SampleApps.editor)), E.event(305, 10, E.window(SampleApps.browser)),
            ])
        #expect(try afkEvents(capture).prefix(2) == [E.event(0, 5, .afk(.notAfk)), E.event(5, 300, .afk(.afk))])
    }

    @Test("turning afk flushes at once")
    func turningAfkFlushesAtOnce() throws {
        let capture = try capture()
        capture.start()
        work(3)
        time.advance(by: 181)
        let writes = store.writes

        time.advance(by: 1)

        #expect(try afkEvents(capture) == [E.event(0, 3, .afk(.notAfk)), E.event(3, 0, .afk(.afk))])
        #expect(store.writes > writes)
    }

    @Test("quitting ends every event now and flushes")
    func quittingEndsEveryEventNowAndFlushes() throws {
        let capture = try capture()
        capture.start()
        work(4)

        capture.stop()

        #expect(try windowEvents(capture) == [E.event(0, 4, E.window(SampleApps.editor))])
        #expect(try afkEvents(capture) == [E.event(0, 4, .afk(.notAfk))])
        #expect(time.scheduledIntervals.isEmpty)
        #expect(sessions.isStarted == false)
    }

    @Test("titles are stored only when the user turned them on")
    func titlesAreStoredOnlyWhenTheUserTurnedThemOn() throws {
        titles.titles = [101: "Draft notes"]
        accessibility.trusted = true
        let capture = try capture()
        capture.start()
        work(10)
        setting.titlesEnabled = true
        capture.refreshTitleMode()
        work(10)
        capture.stop()

        #expect(
            try windowEvents(capture) == [
                E.event(0, 10, E.window(SampleApps.editor)),
                E.event(10, 10, E.window(SampleApps.editor, title: "Draft notes")),
            ])
    }

    @Test("a wall clock jump forward never stretches an event over it")
    func aWallClockJumpForwardNeverStretchesAnEventOverIt() throws {
        let capture = try capture()
        capture.start()
        work(10)
        time.setWall(by: 7_200)
        work(10)
        capture.stop()

        let events = try windowEvents(capture)
        #expect(events.count == 2)
        #expect(events.first?.timestamp == utcInstantOf(FakeTime.origin))
        #expect(events.reduce(0) { $0 + $1.duration } == 20)
    }

    @Test("a wall clock set back never writes an event that overlaps an earlier one")
    func aWallClockSetBackNeverWritesAnEventThatOverlapsAnEarlierOne() throws {
        let capture = try capture()
        capture.start()
        work(10)
        time.setWall(by: -3_600)
        activations.activate(SampleApps.browser)
        work(10)
        capture.stop()

        #expect(
            try windowEvents(capture) == [
                E.event(0, 10, E.window(SampleApps.editor)), E.event(10, 10, E.window(SampleApps.browser)),
            ])
    }

    @Test("a relaunch never writes before the latest stored event")
    func aRelaunchNeverWritesBeforeTheLatestStoredEvent() throws {
        let first = try capture()
        first.start()
        work(30)
        first.stop()
        time.setWall(by: -600)

        let second = try capture()
        second.start()
        work(5)
        second.stop()

        let spans = try windowEvents(second).map { (try epochSecondsOf($0.timestamp), $0.duration) }
        #expect(zip(spans, spans.dropFirst()).allSatisfy { $0.0 + $0.1 <= $1.0 })
    }

    @Test(
        "random sessions never overlap and the window bucket only pauses while away", arguments: Array(UInt64(1)...60))
    func randomSessionsNeverOverlapAndTheWindowBucketOnlyPausesWhileAway(seed: UInt64) throws {
        var random = SeededGenerator(seed: seed)
        let apps = [SampleApps.editor, SampleApps.browser, SampleApps.terminal]
        let engaging = SessionEvent.allCases.filter(\.engagesReason)
        let releasing = SessionEvent.allCases.filter { !$0.engagesReason }
        let capture = try capture()
        var away: [Interval] = []
        var awaySince: Int?
        capture.start()

        for _ in 0..<80 {
            switch Int.random(in: 0...9, using: &random) {
            case 0...3: work(Int.random(in: 1...40, using: &random))
            case 4: time.advance(by: Int.random(in: 1...400, using: &random))
            case 5: activations.activate(apps[Int.random(in: 0..<apps.count, using: &random)])
            case 6: sessions.send(engaging[Int.random(in: 0..<engaging.count, using: &random)])
            case 7: sessions.send(releasing[Int.random(in: 0..<releasing.count, using: &random)])
            default: time.sleep(for: Int.random(in: 1...5_000, using: &random))
            }
            let now = FakeTime.origin + time.now
            if capture.isAway, awaySince == nil {
                awaySince = now
            } else if !capture.isAway, let since = awaySince {
                away.append(Interval(start: since, end: now))
                awaySince = nil
            }
        }
        if let since = awaySince {
            away.append(Interval(start: since, end: FakeTime.origin + time.now))
        }
        capture.stop()

        let window = try windowEvents(capture).map { try Self.span($0) }
        let afk = try afkEvents(capture).map { try Self.span($0) }
        let windowGaps = zip(window, window.dropFirst()).map { Interval(start: $0.end, end: $1.start) }
        #expect(zip(window, window.dropFirst()).allSatisfy { $0.end <= $1.start }, "seed \(seed)")
        #expect(subtractIntervals(windowGaps, away).isEmpty, "seed \(seed)")
        #expect(zip(afk, afk.dropFirst()).allSatisfy { $0.end == $1.start }, "seed \(seed)")
    }

    private static func span(_ event: ActivityEvent) throws -> Interval {
        let start = try epochSecondsOf(event.timestamp)
        return Interval(start: start, end: start + event.duration)
    }
}
