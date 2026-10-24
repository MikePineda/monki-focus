// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * `frictionCandidates(ruleset, observation, now, catalog) → RuleId[]`
 * (SEMANTICS.md §5.7): the access candidates at `now` whose effective mode is
 * friction (§5.5 promotions included), whose escalation states
 * `effectiveEscalationState` combines (§7.4). It is exactly the list `decide`
 * uses, so an adapter that stores the gate never runs `decide` once per rule.
 * Ids in code-unit ascending order. Fail closed (§14): on inputs `decide`
 * rejects it returns `[]`, because `decide` then blocks without a gate.
 */
import type { Instant, Observation, RuleId, Ruleset } from '@monki-focus/rules'
import { accessCandidates } from './AccessAxis.ts'
import {
  candidatePoolsAt,
  decisionSubject,
  frictionRulesOf,
  sortedIds,
} from './DecisionCandidates.ts'
import { guardCandidateInputs } from './DecisionInputGuard.ts'
import { resolveObservation } from './ResolvedObservation.ts'
import type { RulesCatalog } from './RulesCatalog.ts'

export function frictionCandidates(
  ruleset: Ruleset,
  observation: Observation,
  now: Instant,
  catalog: RulesCatalog
): RuleId[] {
  try {
    const nowSeconds = guardCandidateInputs(ruleset, observation, now)
    const subject = decisionSubject(ruleset, resolveObservation(observation, catalog), catalog)
    const pools = candidatePoolsAt(subject, nowSeconds)
    return sortedIds(frictionRulesOf(accessCandidates(pools.access, subject.observation, catalog)))
  } catch {
    return []
  }
}
