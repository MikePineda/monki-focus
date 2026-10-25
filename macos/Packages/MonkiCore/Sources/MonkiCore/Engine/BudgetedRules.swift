// SPDX-License-Identifier: AGPL-3.0-or-later

/// `budgetedRulesFor(ruleset, observation, at, catalog) → RuleId[]`
/// (SEMANTICS.md §5.7): the rules an activity at `at` accrues usage to: every
/// candidate of the budget step (§5.2.2) that carries `dailyBudgetMinutes`,
/// that is every enabled rule scheduled at `at` (pinned zones, §6.3) whose
/// target matches, or with an unknown path the whole unknown-path pool
/// (§5.5). Not only the winner, so a more specific rule never hides a spent
/// budget. Adapters add the activity's seconds to each returned id. Ids in
/// code-unit ascending order. Fail closed (§14): on inputs `decide` rejects
/// it returns every enabled rule with a budget, so an error never leaves
/// time uncounted.
public func budgetedRulesFor(
    _ ruleset: Ruleset,
    observation: Observation,
    at: String,
    catalog: RulesCatalog
) -> [String] {
    do {
        let checked = try guardCandidateInputs(ruleset, observation, at: at)
        let subject = DecisionSubject(
            ruleset: ruleset,
            zones: checked.zones,
            observation: ResolvedObservation(observation, catalog),
            catalog: catalog
        )
        return sortedIds(candidatePoolsAt(subject, checked.seconds).access.filter { $0.dailyBudgetMinutes != nil })
    } catch {
        return sortedIds(ruleset.rules.filter { $0.enabled && $0.dailyBudgetMinutes != nil })
    }
}
