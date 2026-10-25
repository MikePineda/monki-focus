// SPDX-License-Identifier: AGPL-3.0-or-later

/// The phase of one target group's escalation state machine (SEMANTICS.md §7).
public enum EscalationPhase: String, Codable, CaseIterable, Sendable {
    case idle
    case pausing
    case asking
    case active
    case timedOut = "timed_out"
    case overrideWaiting = "override_waiting"
    case overrideActive = "override_active"
}
