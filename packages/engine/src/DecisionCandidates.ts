// SPDX-License-Identifier: AGPL-3.0-or-later
/**
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
import type { Rule, Ruleset } from '@monki-focus/rules'
import type { AccessCandidate } from './AccessAxis.ts'
import { isRuleScheduledAt } from './PinnedTimeZones.ts'
import { hasUnknownPath } from './ResolvedObservation.ts'
import type { ResolvedObservation } from './ResolvedObservation.ts'
import type { RulesCatalog } from './RulesCatalog.ts'
import { matchesHostOfUnknownPath, matchesTarget } from './TargetMatcher.ts'

/** The time-independent half of a decision: who is observed and which rules can apply. */
export interface DecisionSubject {
  ruleset: Ruleset
  observation: ResolvedObservation
  catalog: RulesCatalog
  unknownPath: boolean
  /** Enabled rules that can be candidates for the observation at some instant. */
  pool: readonly Rule[]
}

export interface CandidatePools {
  /** Scheduled rules whose target matches (both axes, §5.1). */
  matching: Rule[]
  /** Access candidates before modes (§5.5 with an unknown path) and the budget pool (§5.2.2). */
  access: Rule[]
}

function inUnknownPathPool(rule: Rule, observation: ResolvedObservation, catalog: RulesCatalog) {
  return (
    observation.kind === 'site' &&
    !observation.pathKnown &&
    matchesHostOfUnknownPath(rule.target, observation.host, catalog)
  )
}

export function decisionSubject(
  ruleset: Ruleset,
  observation: ResolvedObservation,
  catalog: RulesCatalog
): DecisionSubject {
  const pool = ruleset.rules.filter(
    (rule) =>
      rule.enabled &&
      (matchesTarget(rule.target, observation, catalog) ||
        inUnknownPathPool(rule, observation, catalog))
  )
  return { ruleset, observation, catalog, unknownPath: hasUnknownPath(observation), pool }
}

/** The candidates at an instant (schedules in the pinned zones, §6.3). */
export function candidatePoolsAt(subject: DecisionSubject, epochSeconds: number): CandidatePools {
  const { ruleset, observation, catalog, unknownPath } = subject
  const scheduled = subject.pool.filter((rule) => isRuleScheduledAt(rule, ruleset, epochSeconds))
  const matching = scheduled.filter((rule) => matchesTarget(rule.target, observation, catalog))
  return { matching, access: unknownPath ? scheduled : matching }
}

/** Access candidates whose effective mode is friction: they share one escalation (§7.4). */
export function frictionRulesOf(access: readonly AccessCandidate[]): Rule[] {
  return access.filter(({ mode }) => mode === 'friction').map(({ rule }) => rule)
}

/** Rule ids in code-unit ascending order, the order every helper returns (§1). */
export function sortedIds(rules: readonly Rule[]): string[] {
  // The default sort compares UTF-16 code units.
  return rules.map(({ id }) => id).sort()
}
