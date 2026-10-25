// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import MonkiPlatform
import Testing

@MainActor
@Suite("AFK watcher")
struct AFKWatcherTests {
    private let time = FakeTime()
    private let idle: FakeIdleTimeSource
    private let clock: CaptureClock
    private let recorder = Recorder()

    @MainActor
    final class Recorder {
        var observations: [AfkObservation] = []
    }

    init() {
        idle = FakeIdleTimeSource(time: time)
        clock = CaptureClock(wall: time.wall, monotonic: time.monotonic)
    }

    private func watcher() -> AFKWatcher {
        AFKWatcher(idle: idle, timers: time, clock: clock) { [recorder] in
            recorder.observations.append($0)
        }
    }

    private func at(_ offset: Int) -> Int {
        FakeTime.origin + offset
    }

    @Test("it polls the idle time every 5 seconds")
    func itPollsTheIdleTimeEvery5Seconds() {
        let watcher = watcher()

        watcher.start()
        time.advance(by: 15)

        #expect(recorder.observations.count == 4)
        #expect(time.scheduledIntervals == [5])
    }

    @Test("180 seconds without input turn afk dated back to the last input")
    func secondsWithoutInputTurnAfkDatedBackToTheLastInput() {
        let watcher = watcher()
        watcher.start()
        time.advance(by: 10)
        idle.input()

        time.advance(by: 190)

        let transitions = recorder.observations.filter(\.isTransition)
        #expect(
            transitions == [
                AfkObservation(status: .notAfk, at: at(0), isTransition: true),
                AfkObservation(status: .afk, at: at(10), isTransition: true),
            ])
        #expect(watcher.status == .afk)
    }

    @Test("input after afk returns to not-afk at that input")
    func inputAfterAfkReturnsToNotAfkAtThatInput() {
        let watcher = watcher()
        watcher.start()
        time.advance(by: 200)

        time.advance(by: 2)
        idle.input()
        time.advance(by: 3)

        #expect(recorder.observations.last == AfkObservation(status: .notAfk, at: at(202), isTransition: true))
    }

    @Test(
        "sleep, display sleep, session switch and lock force afk immediately",
        arguments: [SessionEvent.systemWillSleep, .screensDidSleep, .sessionDidResignActive, .screenLocked])
    func sleepDisplaySleepSessionSwitchAndLockForceAfkImmediately(event: SessionEvent) {
        let watcher = watcher()
        watcher.start()
        time.advance(by: 7)
        idle.input()

        watcher.handle(event)

        #expect(recorder.observations.last == AfkObservation(status: .afk, at: at(7), isTransition: true))
        #expect(watcher.isForcedAway)
    }

    @Test("unlocking resumes from the idle time")
    func unlockingResumesFromTheIdleTime() {
        let watcher = watcher()
        watcher.start()
        watcher.handle(.screenLocked)
        time.advance(by: 600)
        #expect(recorder.observations.last?.status == .afk)

        idle.input()
        watcher.handle(.screenUnlocked)

        #expect(recorder.observations.last == AfkObservation(status: .notAfk, at: at(600), isTransition: true))
        #expect(watcher.isForcedAway == false)
    }

    @Test("waking resumes once the displays are awake too")
    func wakingResumesOnceTheDisplaysAreAwakeToo() {
        let watcher = watcher()
        watcher.start()
        watcher.handle(.screensDidSleep)
        watcher.handle(.systemWillSleep)
        time.sleep(for: 3_600)
        idle.input()

        watcher.handle(.systemDidWake)
        #expect(watcher.status == .afk)
        watcher.handle(.screensDidWake)

        #expect(recorder.observations.last == AfkObservation(status: .notAfk, at: at(3_600), isTransition: true))
    }

    @Test("a stopped watcher neither polls nor handles events")
    func aStoppedWatcherNeitherPollsNorHandlesEvents() {
        let watcher = watcher()
        watcher.start()
        watcher.stop()
        let count = recorder.observations.count

        time.advance(by: 20)
        watcher.handle(.screenLocked)

        #expect(recorder.observations.count == count)
        #expect(time.scheduledIntervals.isEmpty)
    }
}
