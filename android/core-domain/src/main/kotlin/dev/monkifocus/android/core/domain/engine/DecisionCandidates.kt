// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.Ruleset

/*
 * The candidates of `decide` (SEMANTICS.md §5.1, §5.5), in one place so that
 * `decide`, `validUntil` and the adapter helpers (`frictionCandidates`,
 * `budgetedRulesFor`) can never disagree:
 *
 * - the **target pool**: enabled rules whose target matches the observation
 *   or, with an unknown path, the host's domain or profile (§5.5). Schedules
 *   are not checked yet, so only these rules can ever be candidates for it;
 * - at an instant, the **matching** rules (pool rules scheduled then whose
 *   target matches) and the **access pool**: the matching rules, or with an
 *   unknown path every scheduled pool rule. The access pool also takes part
 *   in the budget step (§5.2.2).
 */

/** The time-independent half of a decision: who is observed and which rules can apply. */
internal data class DecisionSubject(
    val ruleset: Ruleset,
    val observation: ResolvedObservation,
    val catalog: RulesCatalog,
    val unknownPath: Boolean,
    /** Enabled rules that can be candidates for the observation at some instant. */
    val pool: List<Rule>,
)

internal data class CandidatePools(
    /** Scheduled rules whose target matches (both axes, §5.1). */
    val matching: List<Rule>,
    /** Access candidates before modes (§5.5 with an unknown path) and the budget pool (§5.2.2). */
    val access: List<Rule>,
)

private fun inUnknownPathPool(
    rule: Rule,
    observation: ResolvedObservation,
    catalog: RulesCatalog,
): Boolean =
    observation is ResolvedObservation.Site &&
        !observation.pathKnown &&
        matchesHostOfUnknownPath(rule.target, observation.host, catalog)

internal fun decisionSubject(
    ruleset: Ruleset,
    observation: ResolvedObservation,
    catalog: RulesCatalog,
): DecisionSubject {
    val pool =
        ruleset.rules.filter { rule ->
            rule.enabled &&
                (matchesTarget(rule.target, observation, catalog) || inUnknownPathPool(rule, observation, catalog))
        }
    return DecisionSubject(ruleset, observation, catalog, hasUnknownPath(observation), pool)
}

/** The candidates at an instant (schedules in the pinned zones, §6.3). */
internal fun candidatePoolsAt(
    subject: DecisionSubject,
    epochSeconds: Long,
): CandidatePools {
    val scheduled = subject.pool.filter { rule -> isRuleScheduledAt(rule, subject.ruleset, epochSeconds) }
    val matching = scheduled.filter { rule -> matchesTarget(rule.target, subject.observation, subject.catalog) }
    return CandidatePools(matching, if (subject.unknownPath) scheduled else matching)
}

/** Access candidates whose effective mode is friction: they share one escalation (§7.4). */
internal fun frictionRulesOf(access: List<AccessCandidate>): List<Rule> = access.filter { it.mode == AccessMode.FRICTION }.map { it.rule }

/** Rule ids in code-unit ascending order, the order every helper returns (§1). */
internal fun sortedIds(rules: List<Rule>): List<String> =
    // String.compareTo compares UTF-16 code units, like JavaScript's default sort.
    rules.map { it.id }.sorted()
