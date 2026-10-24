// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.Observation
import dev.monkifocus.android.core.domain.rules.Ruleset

/**
 * `frictionCandidates(ruleset, observation, now, catalog) → RuleId[]`
 * (SEMANTICS.md §5.7): the access candidates at `now` whose effective mode is
 * friction (§5.5 promotions included), whose escalation states
 * [effectiveEscalationState] combines (§7.4). It is exactly the list `decide`
 * uses, so an adapter that stores the gate never runs `decide` once per rule.
 * Ids in code-unit ascending order. Fail closed (§14): on inputs `decide`
 * rejects it returns an empty list, because `decide` then blocks without a gate.
 */
fun frictionCandidates(
    ruleset: Ruleset,
    observation: Observation,
    now: String,
    catalog: RulesCatalog,
): List<String> =
    try {
        val nowSeconds = guardCandidateInputs(ruleset, observation, now)
        val subject = decisionSubject(ruleset, resolveObservation(observation, catalog), catalog)
        val pools = candidatePoolsAt(subject, nowSeconds)
        sortedIds(frictionRulesOf(accessCandidates(pools.access, subject.observation, catalog)))
    } catch (_: Exception) {
        emptyList()
    } catch (_: StackOverflowError) {
        emptyList()
    }
