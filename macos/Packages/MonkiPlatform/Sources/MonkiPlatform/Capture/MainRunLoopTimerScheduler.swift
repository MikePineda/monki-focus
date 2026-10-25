// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// `RepeatingTimerScheduler` on main run loop `Timer`s (common modes, so
/// they also fire while a menu is open), with 10 % tolerance to save power.
/// A late or coalesced fire is harmless: observations carry their own time.
@MainActor
public final class MainRunLoopTimerScheduler: RepeatingTimerScheduler {
    private final class Handle: RepeatingTimer {
        let timer: Timer

        init(_ timer: Timer) {
            self.timer = timer
        }

        func cancel() {
            timer.invalidate()
        }
    }

    public init() {}

    public func schedule(every interval: Duration, _ action: @escaping @MainActor @Sendable () -> Void)
        -> any RepeatingTimer
    {
        let seconds = Double(interval.components.seconds) + Double(interval.components.attoseconds) / 1e18
        let timer = Timer(timeInterval: seconds, repeats: true) { _ in
            MainActor.assumeIsolated { action() }
        }
        timer.tolerance = seconds / 10
        RunLoop.main.add(timer, forMode: .common)
        return Handle(timer)
    }
}
