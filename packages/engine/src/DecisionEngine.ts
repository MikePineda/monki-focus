// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * `decide(ruleset, observation, state, now, catalog) → Decision`
 * (SEMANTICS.md §5). Two independent axes, access and content, each choose a
 * winner among the enabled, scheduled, matching rules. Access restrictions
 * are checked in order (bedtime, budget, rule block, friction); each one
 * either applies or is lifted (unlock, emergency override, intention).
 */
import type {
  Access,
  Decision,
  DecisionState,
  Gate,
  Instant,
  Observation,
  ReasonCode,
  Rule,
  RuleId,
  Ruleset,
} from '@monki-focus/rules'
import { accessCandidates, accessWinner } from './AccessAxis.ts'
import type { AccessCandidate } from './AccessAxis.ts'
import { BEDTIME_GROUP, BEDTIME_MAX_LEVEL, isBedtimeActive } from './BedtimePolicy.ts'
import { exhaustedBudgetRule } from './BudgetPolicy.ts'
import { categoryLevelOf } from './CategoryLevelResolver.ts'
import { contentOutcome } from './ContentAxis.ts'
import type { ContentOutcome } from './ContentAxis.ts'
import { decisionGate } from './DecisionGate.ts'
import { isOverrideActive } from './EmergencyOverridePolicy.ts'
import { explanationKeyOf } from './ExplanationKey.ts'
import { epochSecondsOf } from './Instant.ts'
import { isIntentionActive } from './IntentionPolicy.ts'
import { isRuleScheduledAt, localDatesAt, zonesOf } from './PinnedTimeZones.ts'
import { hasUnknownPath, resolveObservation } from './ResolvedObservation.ts'
import type { ResolvedObservation } from './ResolvedObservation.ts'
import type { RulesCatalog } from './RulesCatalog.ts'
import { matchesHostOfUnknownPath, matchesTarget } from './TargetMatcher.ts'
import { hasActiveUnlock } from './UnlockPolicy.ts'

/** A restriction of §5.2 that matched; `group` is its escalation group. */
interface Restriction {
  access: Exclude<Access, 'allow'>
  reason: ReasonCode
  ruleId: RuleId | null
  group: string
  /** Friction: an active intention lifts it and an unlifted one shows a gate. */
  friction?: { winner: Rule; frictionRules: readonly Rule[] }
}

interface AccessOutcome {
  access: Access
  reason: ReasonCode
  ruleId: RuleId | null
  gate?: Gate
}

interface DecisionInputs {
  ruleset: Ruleset
  state: DecisionState
  observation: ResolvedObservation
  nowSeconds: number
  catalog: RulesCatalog
}

/** Enabled rules whose schedules are active now (§5.1, in both zones while one waits, §6.3). */
function scheduledRules({ ruleset, nowSeconds }: DecisionInputs): Rule[] {
  return ruleset.rules.filter(
    (rule) => rule.enabled && isRuleScheduledAt(rule, ruleset, nowSeconds)
  )
}

function liftOf(restriction: Restriction, inputs: DecisionInputs): ReasonCode | null {
  const { state, observation, nowSeconds, catalog } = inputs
  if (hasActiveUnlock(state.unlocks, observation, nowSeconds, catalog)) return 'unlock_active'
  if (isOverrideActive(state.escalation, restriction.group, nowSeconds)) return 'emergency_active'
  if (
    restriction.friction !== undefined &&
    isIntentionActive(state.escalation, restriction.group, nowSeconds)
  ) {
    return 'intention_active'
  }
  return null
}

function restrictionsOf(
  inputs: DecisionInputs,
  budgetCandidates: readonly Rule[],
  access: readonly AccessCandidate[],
  winner: AccessCandidate | null
): Restriction[] {
  const { ruleset, state, observation, nowSeconds, catalog } = inputs
  const restrictions: Restriction[] = []
  if (
    isBedtimeActive(ruleset.bedtime, nowSeconds, zonesOf(ruleset)) &&
    categoryLevelOf(observation, ruleset.categories, catalog) <= BEDTIME_MAX_LEVEL
  ) {
    restrictions.push({
      access: 'block',
      reason: 'schedule_bedtime',
      ruleId: null,
      group: BEDTIME_GROUP,
    })
  }
  const budget = exhaustedBudgetRule(
    budgetCandidates,
    state.usage,
    localDatesAt(ruleset, nowSeconds),
    catalog
  )
  if (budget !== null) {
    restrictions.push({
      access: 'block',
      reason: 'budget_exhausted',
      ruleId: budget.id,
      group: budget.id,
    })
  }
  if (winner?.mode === 'block') {
    restrictions.push({
      access: 'block',
      reason: 'rule_match',
      ruleId: winner.rule.id,
      group: winner.rule.id,
    })
  }
  if (winner?.mode === 'friction') {
    const frictionRules = access.filter(({ mode }) => mode === 'friction').map(({ rule }) => rule)
    restrictions.push({
      access: 'gate',
      reason: 'intention_required',
      ruleId: winner.rule.id,
      group: winner.rule.id,
      friction: { winner: winner.rule, frictionRules },
    })
  }
  return restrictions
}

function accessOutcome(
  inputs: DecisionInputs,
  restrictions: readonly Restriction[],
  winner: AccessCandidate | null
): AccessOutcome {
  let firstLift: AccessOutcome | null = null
  for (const restriction of restrictions) {
    const lift = liftOf(restriction, inputs)
    if (lift !== null) {
      firstLift ??= { access: 'allow', reason: lift, ruleId: restriction.ruleId }
      continue
    }
    const { access, reason, ruleId, friction } = restriction
    if (friction === undefined) return { access, reason, ruleId }
    const { state, nowSeconds } = inputs
    const gate = decisionGate(
      friction.winner,
      friction.frictionRules,
      state.escalation,
      nowSeconds,
      state.guardianLinked
    )
    return { access, reason, ruleId, gate }
  }
  if (firstLift !== null) return firstLift
  return winner === null
    ? { access: 'allow', reason: 'no_rule', ruleId: null }
    : { access: 'allow', reason: 'rule_match', ruleId: winner.rule.id }
}

/** §5.4: the access outcome, unless access merely allows and a hide-feed rule wins the content axis. */
function primaryOutcome(
  access: AccessOutcome,
  content: ContentOutcome
): { reason: ReasonCode; ruleId: RuleId | null } {
  const accessIsPlain =
    access.access === 'allow' && (access.reason === 'rule_match' || access.reason === 'no_rule')
  if (accessIsPlain && content.winner?.mode === 'hide-feed') {
    return { reason: content.reason, ruleId: content.winner.id }
  }
  return { reason: access.reason, ruleId: access.ruleId }
}

export function decide(
  ruleset: Ruleset,
  observation: Observation,
  state: DecisionState,
  now: Instant,
  catalog: RulesCatalog
): Decision {
  const resolved = resolveObservation(observation, catalog)
  const inputs: DecisionInputs = {
    ruleset,
    state,
    observation: resolved,
    nowSeconds: epochSecondsOf(now),
    catalog,
  }
  const scheduled = scheduledRules(inputs)
  const matching = scheduled.filter((rule) => matchesTarget(rule.target, resolved, catalog))
  const unknownPath = hasUnknownPath(resolved)
  // §5.5: with an unknown path every rule of the host's domain and profile competes for access.
  const accessPool =
    resolved.kind === 'site' && unknownPath
      ? scheduled.filter((rule) => matchesHostOfUnknownPath(rule.target, resolved.host, catalog))
      : matching
  const access = accessCandidates(accessPool, resolved, catalog)
  const winner = accessWinner(access, unknownPath, catalog)
  const outcome = accessOutcome(inputs, restrictionsOf(inputs, accessPool, access, winner), winner)
  const content = contentOutcome(matching, resolved, catalog)
  const primary = primaryOutcome(outcome, content)
  return {
    access: outcome.access,
    content: content.content,
    ruleId: primary.ruleId,
    reason: primary.reason,
    ...(outcome.gate === undefined ? {} : { gate: outcome.gate }),
    explanationKey: explanationKeyOf(outcome.access, content.content, primary.reason),
  }
}
