// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The throwing core of `decide(ruleset, observation, state, now, catalog) →
 * Decision` (SEMANTICS.md §5); the public `decide` wraps it fail-closed
 * (`FailClosedDecision.ts`, §14). Two independent axes, access and content, each choose a
 * winner among the enabled, scheduled, matching rules. Access restrictions
 * are checked in order (bedtime, budget, rule block, friction); each one
 * either applies or is lifted (unlock, emergency override, intention).
 * `validUntil` (§5.6) evaluates the same inputs again at the instants where
 * the outcome can change (`DecisionValidity.ts`).
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
import { candidatePoolsAt, decisionSubject, frictionRulesOf } from './DecisionCandidates.ts'
import type { DecisionSubject } from './DecisionCandidates.ts'
import { decisionGate } from './DecisionGate.ts'
import { guardDecisionInputs } from './DecisionInputGuard.ts'
import { validUntilOf } from './DecisionValidity.ts'
import type { TimedDecision } from './DecisionValidity.ts'
import { isOverrideActive } from './EmergencyOverridePolicy.ts'
import { explanationKeyOf } from './ExplanationKey.ts'
import { isIntentionActive } from './IntentionPolicy.ts'
import { localDatesAt, zonesOf } from './PinnedTimeZones.ts'
import { resolveObservation } from './ResolvedObservation.ts'
import type { RulesCatalog } from './RulesCatalog.ts'
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

/** Everything a decision reads: the subject, the state, and the time-independent bedtime level. */
export interface DecisionInputs {
  subject: DecisionSubject
  state: DecisionState
  categoryLevel: number
}

function liftOf(restriction: Restriction, inputs: DecisionInputs, nowSeconds: number) {
  const { state, subject } = inputs
  if (hasActiveUnlock(state.unlocks, subject.observation, nowSeconds, subject.catalog)) {
    return 'unlock_active'
  }
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
  nowSeconds: number,
  budgetCandidates: readonly Rule[],
  access: readonly AccessCandidate[],
  winner: AccessCandidate | null
): Restriction[] {
  const { subject, state, categoryLevel } = inputs
  const { ruleset, catalog } = subject
  const restrictions: Restriction[] = []
  if (
    isBedtimeActive(ruleset.bedtime, nowSeconds, zonesOf(ruleset)) &&
    categoryLevel <= BEDTIME_MAX_LEVEL
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
    restrictions.push({
      access: 'gate',
      reason: 'intention_required',
      ruleId: winner.rule.id,
      group: winner.rule.id,
      friction: { winner: winner.rule, frictionRules: frictionRulesOf(access) },
    })
  }
  return restrictions
}

function accessOutcome(
  inputs: DecisionInputs,
  nowSeconds: number,
  restrictions: readonly Restriction[],
  winner: AccessCandidate | null
): AccessOutcome {
  let firstLift: AccessOutcome | null = null
  for (const restriction of restrictions) {
    const lift = liftOf(restriction, inputs, nowSeconds)
    if (lift !== null) {
      firstLift ??= { access: 'allow', reason: lift, ruleId: restriction.ruleId }
      continue
    }
    const { access, reason, ruleId, friction } = restriction
    if (friction === undefined) return { access, reason, ruleId }
    const { state } = inputs
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

/** Validates the inputs (§14) and resolves what does not depend on the instant. */
export function decisionInputsOf(
  ruleset: Ruleset,
  observation: Observation,
  state: DecisionState,
  now: Instant,
  catalog: RulesCatalog
): { inputs: DecisionInputs; nowSeconds: number } {
  const nowSeconds = guardDecisionInputs(ruleset, observation, state, now)
  const resolved = resolveObservation(observation, catalog)
  const subject = decisionSubject(ruleset, resolved, catalog)
  const categoryLevel = categoryLevelOf(resolved, ruleset.categories, catalog)
  return { inputs: { subject, state, categoryLevel }, nowSeconds }
}

/** The decision at an instant, without `validUntil`. */
export function decisionAt(inputs: DecisionInputs, nowSeconds: number): TimedDecision {
  const { subject } = inputs
  const pools = candidatePoolsAt(subject, nowSeconds)
  const access = accessCandidates(pools.access, subject.observation, subject.catalog)
  const winner = accessWinner(access, subject.unknownPath, subject.catalog)
  const restrictions = restrictionsOf(inputs, nowSeconds, pools.access, access, winner)
  const outcome = accessOutcome(inputs, nowSeconds, restrictions, winner)
  const content = contentOutcome(pools.matching, subject.observation, subject.catalog)
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

export function decideOrThrow(
  ruleset: Ruleset,
  observation: Observation,
  state: DecisionState,
  now: Instant,
  catalog: RulesCatalog
): Decision {
  const { inputs, nowSeconds } = decisionInputsOf(ruleset, observation, state, now, catalog)
  const decision = decisionAt(inputs, nowSeconds)
  const validUntil = validUntilOf(inputs, decision, nowSeconds, (seconds) =>
    decisionAt(inputs, seconds)
  )
  return { ...decision, validUntil }
}
