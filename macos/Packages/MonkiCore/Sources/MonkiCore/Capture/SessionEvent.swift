// SPDX-License-Identifier: AGPL-3.0-or-later

/// A power or session notification, independent of AppKit. The platform
/// adapter maps `NSWorkspace` and the screen-lock distributed notifications
/// onto these cases.
public enum SessionEvent: String, Hashable, Sendable, CaseIterable {
    case systemWillSleep
    case systemDidWake
    case screensDidSleep
    case screensDidWake
    case sessionDidResignActive
    case sessionDidBecomeActive
    case screenLocked
    case screenUnlocked
    case systemWillPowerOff

    /// The away reason this event engages or releases.
    public var reason: AwayReason {
        switch self {
        case .systemWillSleep, .systemDidWake: .systemSleep
        case .screensDidSleep, .screensDidWake: .screensAsleep
        case .sessionDidResignActive, .sessionDidBecomeActive: .sessionInactive
        case .screenLocked, .screenUnlocked: .screenLocked
        case .systemWillPowerOff: .poweringOff
        }
    }

    /// True when the event starts its reason (sleep, lock), false when it ends it (wake, unlock).
    public var engagesReason: Bool {
        switch self {
        case .systemWillSleep, .screensDidSleep, .sessionDidResignActive, .screenLocked, .systemWillPowerOff: true
        case .systemDidWake, .screensDidWake, .sessionDidBecomeActive, .screenUnlocked: false
        }
    }

    /// Whether pending events must reach the database before the system
    /// acts on this event (sleep, display sleep, lock, power off).
    public var requiresFlush: Bool {
        engagesReason
    }
}
