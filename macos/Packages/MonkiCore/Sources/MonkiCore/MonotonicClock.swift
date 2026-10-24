// SPDX-License-Identifier: AGPL-3.0-or-later

/// A clock that only moves forward, unaffected by changes to the wall clock.
/// Pauses, escalation windows and pulse times are measured with it so that
/// moving the system time cannot shorten them. The platform adapter is
/// `SystemMonotonicClock` in MonkiPlatform; tests use `FakeMonotonicClock`.
public protocol MonotonicClock: Sendable {
    /// Time elapsed since an arbitrary, fixed origin (for example boot).
    /// Only differences between two readings are meaningful.
    func elapsed() -> Duration
}
