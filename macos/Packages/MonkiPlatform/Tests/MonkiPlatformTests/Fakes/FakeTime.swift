// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import MonkiCoreTesting
import MonkiPlatform

/// A fixed wall clock, a fake monotonic clock and a timer scheduler that
/// move together: `advance(by:)` steps one second at a time and fires every
/// timer that falls due, like the main run loop would.
@MainActor
final class FakeTime: RepeatingTimerScheduler {
    /// 2026-10-26T00:00:00Z.
    nonisolated static let origin = 1_792_972_800

    private final class Scheduled: RepeatingTimer {
        let interval: Int
        var nextFire: Int
        let action: @MainActor @Sendable () -> Void
        var isCancelled = false

        init(interval: Int, nextFire: Int, action: @escaping @MainActor @Sendable () -> Void) {
            self.interval = interval
            self.nextFire = nextFire
            self.action = action
        }

        func cancel() {
            isCancelled = true
        }
    }

    let wall = FixedClock(Date(timeIntervalSince1970: TimeInterval(FakeTime.origin)))
    let monotonic = FakeMonotonicClock(start: .seconds(10_000))
    private var elapsed = 0
    private var timers: [Scheduled] = []

    /// Seconds since the origin on the wall clock.
    var now: Int {
        Int(wall.now().timeIntervalSince1970) - Self.origin
    }

    /// Intervals of the timers still scheduled, in seconds.
    var scheduledIntervals: [Int] {
        timers.filter { !$0.isCancelled }.map(\.interval).sorted()
    }

    func schedule(every interval: Duration, _ action: @escaping @MainActor @Sendable () -> Void) -> any RepeatingTimer {
        let seconds = Int(interval.components.seconds)
        let timer = Scheduled(interval: seconds, nextFire: elapsed + seconds, action: action)
        timers.append(timer)
        return timer
    }

    /// Moves both clocks forward, firing due timers each second.
    func advance(by seconds: Int) {
        for _ in 0..<seconds {
            elapsed += 1
            wall.advance(by: 1)
            monotonic.advance(by: .seconds(1))
            for timer in timers where !timer.isCancelled && timer.nextFire <= elapsed {
                timer.nextFire += timer.interval
                timer.action()
            }
        }
    }

    /// Moves time forward without firing any timer (the Mac asleep, or a
    /// throttled app), then lets the timers catch up once.
    func sleep(for seconds: Int) {
        elapsed += seconds
        wall.advance(by: TimeInterval(seconds))
        monotonic.advance(by: .seconds(seconds))
        for timer in timers where !timer.isCancelled {
            timer.nextFire = max(timer.nextFire, elapsed + 1)
        }
    }

    /// Changes only the wall clock (the user set the time).
    func setWall(by seconds: Int) {
        wall.advance(by: TimeInterval(seconds))
    }
}
