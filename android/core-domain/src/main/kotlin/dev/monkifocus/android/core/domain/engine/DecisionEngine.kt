// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.Access
import dev.monkifocus.android.core.domain.rules.Decision
import dev.monkifocus.android.core.domain.rules.DecisionState
import dev.monkifocus.android.core.domain.rules.Gate
import dev.monkifocus.android.core.domain.rules.Observation
import dev.monkifocus.android.core.domain.rules.ReasonCode
import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Ruleset

/*
 * The throwing core of `decide(ruleset, observation, state, now, catalog) →
 * Decision` (SEMANTICS.md §5); the public `decide` wraps it fail-closed
 * (`FailClosedDecision.kt`, §14). Two independent axes, access and content,
 * each choose a winner among the enabled, scheduled, matching rules. Access
 * restrictions are checked in order (bedtime, budget, rule block, friction);
 * each one either applies or is lifted (unlock, emergency override, intention).
 * `validUntil` (§5.6) evaluates the same inputs again at the instants where
 * the outcome can change (`DecisionValidity.kt`).
 */

/** The friction part of a restriction: an active intention lifts it and an unlifted one shows a gate. */
private data class FrictionRestriction(
    val winner: Rule,
    val frictionRules: List<Rule>,
)

/** A restriction of §5.2 that matched; `group` is its escalation group. */
private data class Restriction(
    val access: Access,
    val reason: ReasonCode,
    val ruleId: String?,
    val group: String,
    val friction: FrictionRestriction? = null,
)

private data class AccessOutcome(
    val access: Access,
    val reason: ReasonCode,
    val ruleId: String?,
    val gate: Gate? = null,
)

/** Everything a decision reads: the subject, the state, and the time-independent bedtime level. */
internal data class DecisionInputs(
    val subject: DecisionSubject,
    val state: DecisionState,
    val categoryLevel: Int,
)

private fun liftOf(
    restriction: Restriction,
    inputs: DecisionInputs,
    nowSeconds: Long,
): ReasonCode? {
    val (subject, state) = inputs
    return when {
        hasActiveUnlock(state.unlocks, subject.observation, nowSeconds, subject.catalog) -> ReasonCode.UNLOCK_ACTIVE
        isOverrideActive(state.escalation, restriction.group, nowSeconds) -> ReasonCode.EMERGENCY_ACTIVE
        restriction.friction != null && isIntentionActive(state.escalation, restriction.group, nowSeconds) -> ReasonCode.INTENTION_ACTIVE
        else -> null
    }
}

private fun restrictionsOf(
    inputs: DecisionInputs,
    nowSeconds: Long,
    budgetCandidates: List<Rule>,
    access: List<AccessCandidate>,
    winner: AccessCandidate?,
): List<Restriction> {
    val (subject, state, categoryLevel) = inputs
    val ruleset = subject.ruleset
    val catalog = subject.catalog
    val restrictions = mutableListOf<Restriction>()
    if (isBedtimeActive(ruleset.bedtime, nowSeconds, zonesOf(ruleset)) && categoryLevel <= BEDTIME_MAX_LEVEL) {
        restrictions += Restriction(Access.BLOCK, ReasonCode.SCHEDULE_BEDTIME, null, BEDTIME_GROUP)
    }
    val budget = exhaustedBudgetRule(budgetCandidates, state.usage, localDatesAt(ruleset, nowSeconds), catalog)
    if (budget != null) restrictions += Restriction(Access.BLOCK, ReasonCode.BUDGET_EXHAUSTED, budget.id, budget.id)
    if (winner?.mode == AccessMode.BLOCK) {
        restrictions += Restriction(Access.BLOCK, ReasonCode.RULE_MATCH, winner.rule.id, winner.rule.id)
    }
    if (winner?.mode == AccessMode.FRICTION) {
        restrictions +=
            Restriction(
                Access.GATE,
                ReasonCode.INTENTION_REQUIRED,
                winner.rule.id,
                winner.rule.id,
                FrictionRestriction(winner.rule, frictionRulesOf(access)),
            )
    }
    return restrictions
}

private fun accessOutcome(
    inputs: DecisionInputs,
    nowSeconds: Long,
    restrictions: List<Restriction>,
    winner: AccessCandidate?,
): AccessOutcome {
    var firstLift: AccessOutcome? = null
    for (restriction in restrictions) {
        val lift = liftOf(restriction, inputs, nowSeconds)
        if (lift != null) {
            if (firstLift == null) firstLift = AccessOutcome(Access.ALLOW, lift, restriction.ruleId)
            continue
        }
        val friction = restriction.friction ?: return AccessOutcome(restriction.access, restriction.reason, restriction.ruleId)
        val gate =
            decisionGate(
                friction.winner,
                friction.frictionRules,
                inputs.state.escalation,
                nowSeconds,
                inputs.state.guardianLinked,
            )
        return AccessOutcome(restriction.access, restriction.reason, restriction.ruleId, gate)
    }
    if (firstLift != null) return firstLift
    return if (winner == null) {
        AccessOutcome(Access.ALLOW, ReasonCode.NO_RULE, null)
    } else {
        AccessOutcome(Access.ALLOW, ReasonCode.RULE_MATCH, winner.rule.id)
    }
}

/** §5.4: the access outcome, unless access merely allows and a hide-feed rule wins the content axis. */
private fun primaryOutcome(
    access: AccessOutcome,
    content: ContentOutcome,
): Pair<ReasonCode, String?> {
    val accessIsPlain = access.access == Access.ALLOW && (access.reason == ReasonCode.RULE_MATCH || access.reason == ReasonCode.NO_RULE)
    val contentWinner = content.winner
    if (accessIsPlain && contentWinner?.mode == RuleMode.HIDE_FEED) return content.reason to contentWinner.id
    return access.reason to access.ruleId
}

/** Validates the inputs (§14) and resolves what does not depend on the instant; returns them with `now` in epoch seconds. */
internal fun decisionInputsOf(
    ruleset: Ruleset,
    observation: Observation,
    state: DecisionState,
    now: String,
    catalog: RulesCatalog,
): Pair<DecisionInputs, Long> {
    val nowSeconds = guardDecisionInputs(ruleset, observation, state, now)
    val resolved = resolveObservation(observation, catalog)
    val subject = decisionSubject(ruleset, resolved, catalog)
    val categoryLevel = categoryLevelOf(resolved, ruleset.categories, catalog)
    return DecisionInputs(subject, state, categoryLevel) to nowSeconds
}

/** The decision at an instant, with `validUntil` still null. */
internal fun decisionAt(
    inputs: DecisionInputs,
    nowSeconds: Long,
): Decision {
    val subject = inputs.subject
    val pools = candidatePoolsAt(subject, nowSeconds)
    val access = accessCandidates(pools.access, subject.observation, subject.catalog)
    val winner = accessWinner(access, subject.unknownPath, subject.catalog)
    val restrictions = restrictionsOf(inputs, nowSeconds, pools.access, access, winner)
    val outcome = accessOutcome(inputs, nowSeconds, restrictions, winner)
    val content = contentOutcome(pools.matching, subject.observation, subject.catalog)
    val (reason, ruleId) = primaryOutcome(outcome, content)
    return Decision(
        access = outcome.access,
        content = content.content,
        ruleId = ruleId,
        reason = reason,
        gate = outcome.gate,
        explanationKey = explanationKeyOf(outcome.access, content.content, reason),
        validUntil = null,
    )
}

internal fun decideOrThrow(
    ruleset: Ruleset,
    observation: Observation,
    state: DecisionState,
    now: String,
    catalog: RulesCatalog,
): Decision {
    val (inputs, nowSeconds) = decisionInputsOf(ruleset, observation, state, now, catalog)
    val decision = decisionAt(inputs, nowSeconds)
    val validUntil = validUntilOf(inputs.subject, inputs.state, decision, nowSeconds) { seconds -> decisionAt(inputs, seconds) }
    return decision.copy(validUntil = validUntil)
}
