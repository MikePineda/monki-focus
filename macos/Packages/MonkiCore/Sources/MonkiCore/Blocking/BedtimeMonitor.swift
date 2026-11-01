// SPDX-License-Identifier: AGPL-3.0-or-later

/// Turns the bedtime phase and the bedtime emergency override into what the
/// Mac shows: one warning notification each time the lead-up starts (also
/// when the app starts inside it), and the dimming overlay on every screen
/// while bedtime is active and no emergency access has been granted.
public struct BedtimeMonitor: Hashable, Sendable {
    private var previous: BedtimePhase?

    public init() {}

    public mutating func update(phase: BedtimePhase, emergency: EmergencyStatus) -> BedtimeUpdate {
        let notify = phase == .warning && previous != .warning
        previous = phase
        let overlay: BedtimeOverlay
        switch (phase, emergency) {
        case (.active, .active):
            overlay = .hidden
        case (.active, _):
            overlay = .dimmed(emergency: emergency)
        default:
            overlay = .hidden
        }
        return BedtimeUpdate(notifyWarning: notify, overlay: overlay)
    }
}
