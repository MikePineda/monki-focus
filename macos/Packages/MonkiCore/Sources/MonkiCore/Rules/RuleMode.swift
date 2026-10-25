// SPDX-License-Identifier: AGPL-3.0-or-later

/// What a rule does. `allow`, `friction` and `block` compete on the access
/// axis; `hide-feed` and `allow` on the content axis (SEMANTICS.md §5.1).
public enum RuleMode: String, Codable, CaseIterable, Sendable {
    case allow
    case hideFeed = "hide-feed"
    case friction
    case block
}
