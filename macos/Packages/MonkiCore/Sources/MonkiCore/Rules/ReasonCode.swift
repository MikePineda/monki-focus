// SPDX-License-Identifier: AGPL-3.0-or-later

/// Why a decision came out as it did. Adapters log this code, never URLs or titles.
public enum ReasonCode: String, Codable, CaseIterable, Sendable {
    case noRule = "no_rule"
    case ruleMatch = "rule_match"
    case intentionRequired = "intention_required"
    case intentionActive = "intention_active"
    case scheduleBedtime = "schedule_bedtime"
    case budgetExhausted = "budget_exhausted"
    case unlockActive = "unlock_active"
    case emergencyActive = "emergency_active"
    case permalinkNeverHidden = "permalink_never_hidden"
    case pathUnknownAllow = "path_unknown_allow"
    case notAFeed = "not_a_feed"
    case engineError = "engine_error"
}
