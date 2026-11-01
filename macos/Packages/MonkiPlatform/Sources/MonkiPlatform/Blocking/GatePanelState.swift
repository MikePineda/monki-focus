// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// What the gate panel shows for a hidden app. Codes and numbers only: the
/// app's display name is shown locally and never stored or logged.
public struct GatePanelState: Hashable, Sendable {
    public enum Mode: Hashable, Sendable {
        /// The pause runs; only closing is offered.
        case pausing(remainingSeconds: Int, totalSeconds: Int)
        /// The pause is over: the intention and its minutes may be given.
        case asking(requirements: IntentionRequirements)
        /// The app is blocked (a block rule, a spent budget or an engine error).
        case blocked(reason: ReasonCode)
    }

    public var appName: String?
    public var mode: Mode
    /// The escalation level (0…3), for the neutral "level" line.
    public var level: Int?
    /// The emergency override is offered only with a group to lift.
    public var emergencyAvailable: Bool
    public var emergency: EmergencyStatus

    public init(appName: String?, mode: Mode, level: Int?, emergencyAvailable: Bool, emergency: EmergencyStatus) {
        self.appName = appName
        self.mode = mode
        self.level = level
        self.emergencyAvailable = emergencyAvailable
        self.emergency = emergency
    }
}
