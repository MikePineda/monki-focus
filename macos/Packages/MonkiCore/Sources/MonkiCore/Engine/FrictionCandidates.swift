// SPDX-License-Identifier: AGPL-3.0-or-later

/// `frictionCandidates(ruleset, observation, now, catalog) → RuleId[]`
/// (SEMANTICS.md §5.7): the access candidates at `now` whose effective mode
/// is friction (§5.5 promotions included), whose escalation states
/// `effectiveEscalationState` combines (§7.4). It is exactly the list
/// `decide` uses, so an adapter that stores the gate never runs `decide` once
/// per rule. Ids in code-unit ascending order. Fail closed (§14): on inputs
/// `decide` rejects it returns `[]`, because `decide` then blocks without a gate.
public func frictionCandidates(
    _ ruleset: Ruleset,
    observation: Observation,
    now: String,
    catalog: RulesCatalog
) -> [String] {
    do {
        let checked = try guardCandidateInputs(ruleset, observation, at: now)
        let subject = DecisionSubject(
            ruleset: ruleset,
            zones: checked.zones,
            observation: ResolvedObservation(observation, catalog),
            catalog: catalog
        )
        let pools = candidatePoolsAt(subject, checked.seconds)
        return sortedIds(frictionRulesOf(accessCandidates(pools.access, subject.observation, catalog)))
    } catch {
        return []
    }
}
