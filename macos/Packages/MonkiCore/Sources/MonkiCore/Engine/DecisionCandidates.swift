// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

// The candidates of `decide` (SEMANTICS.md §5.1, §5.5), in one place so that
// `decide`, `validUntil` and the adapter helpers (`frictionCandidates`,
// `budgetedRulesFor`) can never disagree:
//
// - the **target pool**: enabled rules whose target matches the observation
//   or, with an unknown path, the host's domain or profile (§5.5). Schedules
//   are not checked yet, so only these rules can ever be candidates for it;
// - at an instant, the **matching** rules (pool rules scheduled then whose
//   target matches) and the **access pool**: the matching rules, or with an
//   unknown path every scheduled pool rule. The access pool also takes part
//   in the budget step (§5.2.2).

/// The time-independent half of a decision: who is observed and which rules can apply.
struct DecisionSubject {
    let ruleset: Ruleset
    let zones: [TimeZone]
    let observation: ResolvedObservation
    let catalog: RulesCatalog
    let unknownPath: Bool
    /// Enabled rules that can be candidates for the observation at some instant.
    let pool: [Rule]

    init(ruleset: Ruleset, zones: [TimeZone], observation: ResolvedObservation, catalog: RulesCatalog) {
        self.ruleset = ruleset
        self.zones = zones
        self.observation = observation
        self.catalog = catalog
        unknownPath = observation.hasUnknownPath
        pool = ruleset.rules.filter { rule in
            guard rule.enabled else { return false }
            if matchesTarget(rule.target, observation, catalog) { return true }
            guard let host = observation.hostOfUnknownPath else { return false }
            return matchesHostOfUnknownPath(rule.target, host: host, catalog)
        }
    }
}

struct CandidatePools {
    /// Scheduled rules whose target matches (both axes, §5.1).
    let matching: [Rule]
    /// Access candidates before modes (§5.5 with an unknown path) and the budget pool (§5.2.2).
    let access: [Rule]
}

/// The candidates at an instant (schedules in the pinned zones, §6.3).
func candidatePoolsAt(_ subject: DecisionSubject, _ epochSeconds: Int) -> CandidatePools {
    let scheduled = subject.pool.filter {
        isRuleScheduledAt($0, workHours: subject.ruleset.workHours, epochSeconds, zones: subject.zones)
    }
    let matching = scheduled.filter { matchesTarget($0.target, subject.observation, subject.catalog) }
    return CandidatePools(matching: matching, access: subject.unknownPath ? scheduled : matching)
}

/// Access candidates whose effective mode is friction: they share one escalation (§7.4).
func frictionRulesOf(_ access: [AccessCandidate]) -> [Rule] {
    access.filter { $0.mode == .friction }.map(\.rule)
}

/// Rule ids in code-unit ascending order, the order every helper returns (§1).
func sortedIds(_ rules: [Rule]) -> [String] {
    rules.map(\.id).sorted(by: CodeUnitOrder.less)
}
