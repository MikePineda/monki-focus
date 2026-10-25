// SPDX-License-Identifier: AGPL-3.0-or-later

/// The content axis of a decision.
public enum Content: String, Codable, CaseIterable, Sendable {
    case show
    case hideFeed = "hide-feed"
}
