// SPDX-License-Identifier: AGPL-3.0-or-later

/// A side effect an escalation transition asks the adapter to perform.
public enum EscalationEffect: String, Codable, CaseIterable, Sendable {
    /// An emergency override was granted: always reported to the guardian (queued while offline).
    case recordBypass = "record_bypass"
}
