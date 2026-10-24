// SPDX-License-Identifier: AGPL-3.0-or-later

import Darwin
import MonkiCore

/// The real monotonic clock: `CLOCK_MONOTONIC_RAW`, which on Darwin keeps
/// counting while the Mac sleeps (a pause started before sleep is over after
/// it) and ignores changes to the wall clock.
public struct SystemMonotonicClock: MonotonicClock {
    public init() {}

    public func elapsed() -> Duration {
        .nanoseconds(clock_gettime_nsec_np(CLOCK_MONOTONIC_RAW))
    }
}
