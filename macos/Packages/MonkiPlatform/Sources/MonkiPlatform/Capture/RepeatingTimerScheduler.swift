// SPDX-License-Identifier: AGPL-3.0-or-later

/// A scheduled repeating action; `cancel()` stops it for good.
@MainActor
public protocol RepeatingTimer: AnyObject {
    func cancel()
}

/// Runs actions periodically on the main actor (`MainRunLoopTimerScheduler`;
/// tests fire timers by hand as they advance fake clocks).
@MainActor
public protocol RepeatingTimerScheduler: AnyObject {
    func schedule(every interval: Duration, _ action: @escaping @MainActor @Sendable () -> Void) -> any RepeatingTimer
}
