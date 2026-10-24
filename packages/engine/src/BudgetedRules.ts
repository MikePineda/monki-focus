// SPDX-License-Identifier: AGPL-3.0-or-later
/**
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
import type { Instant, Observation, Rule, RuleId, Ruleset } from '@monki-focus/rules'
import { candidatePoolsAt, decisionSubject, sortedIds } from './DecisionCandidates.ts'
import { guardCandidateInputs } from './DecisionInputGuard.ts'
import { resolveObservation } from './ResolvedObservation.ts'
import type { RulesCatalog } from './RulesCatalog.ts'

function hasBudget(rule: Rule): boolean {
  return rule.dailyBudgetMinutes !== undefined
}

function everyBudgetedRule(ruleset: Ruleset): RuleId[] {
  try {
    return sortedIds(ruleset.rules.filter((rule) => rule.enabled && hasBudget(rule)))
  } catch {
    return []
  }
}

export function budgetedRulesFor(
  ruleset: Ruleset,
  observation: Observation,
  at: Instant,
  catalog: RulesCatalog
): RuleId[] {
  try {
    const seconds = guardCandidateInputs(ruleset, observation, at)
    const subject = decisionSubject(ruleset, resolveObservation(observation, catalog), catalog)
    return sortedIds(candidatePoolsAt(subject, seconds).access.filter(hasBudget))
  } catch {
    return everyBudgetedRule(ruleset)
  }
}
