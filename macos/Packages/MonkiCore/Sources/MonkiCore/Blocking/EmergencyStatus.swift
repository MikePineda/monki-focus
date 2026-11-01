// SPDX-License-Identifier: AGPL-3.0-or-later

/// Where one group's emergency override stands, for the gate and bedtime screens.
public enum EmergencyStatus: Hashable, Sendable {
    case none
    /// Waiting for the grant; `remaining` reaches zero just before it.
    case waiting(remaining: Duration)
    /// Granted: the group's restriction is lifted for `remaining`.
    case active(remaining: Duration)
}
