// SPDX-License-Identifier: AGPL-3.0-or-later

/// The i18n key that explains a decision; the domain never returns text.
public enum ExplanationKey: String, Codable, CaseIterable, Sendable {
    case noRule = "decision.no_rule"
    case allowedByRule = "decision.allowed_by_rule"
    case blockedByRule = "decision.blocked_by_rule"
    case feedHidden = "decision.feed_hidden"
    case intentionRequired = "decision.intention_required"
    case intentionActive = "decision.intention_active"
    case scheduleBedtime = "decision.schedule_bedtime"
    case budgetExhausted = "decision.budget_exhausted"
    case unlockActive = "decision.unlock_active"
    case emergencyActive = "decision.emergency_active"
    case permalinkNeverHidden = "decision.permalink_never_hidden"
    case pathUnknownAllow = "decision.path_unknown_allow"
    case notAFeed = "decision.not_a_feed"
    case engineError = "decision.engine_error"

    /// SEMANTICS.md §5.4: fixed by the primary outcome. For `rule_match`:
    /// blocked when access blocks, else feed hidden when content hides it,
    /// else allowed; every other reason maps to `decision.<reason>`.
    static func of(access: Access, content: Content, reason: ReasonCode) -> ExplanationKey {
        guard reason == .ruleMatch else {
            // Every reason other than rule_match has a key of the same name.
            return ExplanationKey(rawValue: "decision." + reason.rawValue) ?? .engineError
        }
        if access == .block { return .blockedByRule }
        return content == .hideFeed ? .feedHidden : .allowedByRule
    }
}
