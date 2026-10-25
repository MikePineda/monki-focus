// SPDX-License-Identifier: AGPL-3.0-or-later

/// The access axis of a decision.
public enum Access: String, Codable, CaseIterable, Sendable {
    case allow
    case gate
    case block
}
