// SPDX-License-Identifier: AGPL-3.0-or-later

/// Why the user is away whatever the idle time says. While any reason is
/// engaged the AFK status is `afk` and window capture is paused.
public enum AwayReason: String, Hashable, Sendable, CaseIterable {
    /// The Mac is going to sleep (or asleep).
    case systemSleep
    /// The displays are asleep.
    case screensAsleep
    /// Another user session is in front (fast user switching).
    case sessionInactive
    /// The screen is locked.
    case screenLocked
    /// The Mac is shutting down, restarting or logging out.
    case poweringOff
}
