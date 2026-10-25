// SPDX-License-Identifier: AGPL-3.0-or-later

/// The cadence of activity capture on the Mac (plan §4.3), in whole seconds.
public enum CaptureTiming {
    /// How often the AFK watcher reads the idle time.
    public static let afkPollSeconds = 5

    /// Idle time after which the user counts as away from the keyboard.
    public static let afkThresholdSeconds = 180

    /// How often the heartbeat queue writes its batch to the database.
    public static let flushSeconds = 10

    /// ActivityWatch pulsetime: when capture resumes after a stop (sleep,
    /// lock, quit) with the same data at most this long after the last event
    /// ended, the heartbeat extends that event instead of opening a new one.
    /// Continuous capture never depends on it (see `StateHeartbeatEmitter`).
    public static let pulsetimeSeconds = 10

    /// Wall-clock drift from the monotonic prediction tolerated before the
    /// capture timeline treats a reading as a clock change.
    public static let clockJumpToleranceSeconds = 2
}
