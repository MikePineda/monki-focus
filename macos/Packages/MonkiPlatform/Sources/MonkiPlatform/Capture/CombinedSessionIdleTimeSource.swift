// SPDX-License-Identifier: AGPL-3.0-or-later

import CoreGraphics

/// `IdleTimeSource` on `CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType:)`.
///
/// The "any input" event type is `kCGAnyInputEventType`, `(CGEventType)(~0)`:
/// CGEventSource.h documents "To get the elapsed time since the previous
/// input event --- keyboard, mouse, or tablet --- specify
/// `kCGAnyInputEventType`" and CGEventTypes.h defines it as `~0` (macOS 26
/// SDK). Swift does not import the macro, so it is rebuilt from its raw
/// value. `.null` (kCGEventNull, 0) is not "any": checked on macOS 26, it
/// returned about two weeks while the user was typing, `~0` under a second.
public struct CombinedSessionIdleTimeSource: IdleTimeSource {
    static let anyInputEventType = CGEventType(rawValue: ~0)

    public init() {}

    public func secondsSinceLastInput() -> Double {
        guard let anyInput = Self.anyInputEventType else { return 0 }
        return CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: anyInput)
    }
}
