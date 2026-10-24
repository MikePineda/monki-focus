// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.Observation
import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.Ruleset

/*
 * `budgetedRulesFor(ruleset, observation, at, catalog) → RuleId[]`
 * (SEMANTICS.md §5.7): the rules an activity at `at` accrues usage to: every
 * candidate of the budget step (§5.2.2) that carries `dailyBudgetMinutes`,
 * that is every enabled rule scheduled at `at` (pinned zones, §6.3) whose
 * target matches, or with an unknown path the whole unknown-path pool (§5.5).
 * Not only the winner, so a more specific rule never hides a spent budget.
 * Adapters add the activity's seconds to each returned id. Ids in code-unit
 * ascending order. Fail closed (§14): on inputs `decide` rejects it returns
 * every enabled rule with a budget, so an error never leaves time uncounted.
 */

private fun hasBudget(rule: Rule): Boolean = rule.dailyBudgetMinutes != null

private fun everyBudgetedRule(ruleset: Ruleset): List<String> = sortedIds(ruleset.rules.filter { it.enabled && hasBudget(it) })

fun budgetedRulesFor(
    ruleset: Ruleset,
    observation: Observation,
    at: String,
    catalog: RulesCatalog,
): List<String> =
    try {
        val seconds = guardCandidateInputs(ruleset, observation, at)
        val subject = decisionSubject(ruleset, resolveObservation(observation, catalog), catalog)
        sortedIds(candidatePoolsAt(subject, seconds).access.filter(::hasBudget))
    } catch (_: Exception) {
        everyBudgetedRule(ruleset)
    } catch (_: StackOverflowError) {
        everyBudgetedRule(ruleset)
    }
