// SPDX-License-Identifier: AGPL-3.0-or-later

/// Seconds since the user last touched the keyboard, mouse or trackpad
/// (`CombinedSessionIdleTimeSource`; a fake in tests).
public protocol IdleTimeSource {
    func secondsSinceLastInput() -> Double
}
