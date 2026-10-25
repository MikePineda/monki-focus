// SPDX-License-Identifier: AGPL-3.0-or-later

/// The outcome of `effectiveRuleSet` (SEMANTICS.md §8): what applies today
/// and when the new rule set takes full effect (nil when it already does).
public struct EffectiveRuleSet: Hashable, Sendable {
    public var effectiveToday: Ruleset
    public var effectiveFrom: String?

    public init(effectiveToday: Ruleset, effectiveFrom: String?) {
        self.effectiveToday = effectiveToday
        self.effectiveFrom = effectiveFrom
    }
}
