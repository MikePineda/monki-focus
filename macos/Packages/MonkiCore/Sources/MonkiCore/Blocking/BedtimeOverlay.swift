// SPDX-License-Identifier: AGPL-3.0-or-later

/// The bedtime overlay over every screen: hidden, or dimmed with the state
/// of the emergency button (`none`: offered; `waiting`: counting down).
public enum BedtimeOverlay: Hashable, Sendable {
    case hidden
    case dimmed(emergency: EmergencyStatus)
}
