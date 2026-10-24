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

private data class DecisionInputs(
    val ruleset: Ruleset,
    val state: DecisionState,
    val observation: ResolvedObservation,
    val nowSeconds: Long,
    val catalog: RulesCatalog,
)

/** Enabled rules whose schedules are active now (§5.1, in both zones while one waits, §6.3). */
private fun scheduledRules(inputs: DecisionInputs): List<Rule> =
    inputs.ruleset.rules.filter { rule -> rule.enabled && isRuleScheduledAt(rule, inputs.ruleset, inputs.nowSeconds) }

private fun liftOf(
    restriction: Restriction,
    inputs: DecisionInputs,
): ReasonCode? {
    val (_, state, observation, nowSeconds, catalog) = inputs
    return when {
        hasActiveUnlock(state.unlocks, observation, nowSeconds, catalog) -> ReasonCode.UNLOCK_ACTIVE
        isOverrideActive(state.escalation, restriction.group, nowSeconds) -> ReasonCode.EMERGENCY_ACTIVE
        restriction.friction != null && isIntentionActive(state.escalation, restriction.group, nowSeconds) -> ReasonCode.INTENTION_ACTIVE
        else -> null
    }
}

private fun restrictionsOf(
    inputs: DecisionInputs,
    budgetCandidates: List<Rule>,
    access: List<AccessCandidate>,
    winner: AccessCandidate?,
): List<Restriction> {
    val (ruleset, state, observation, nowSeconds, catalog) = inputs
    val restrictions = mutableListOf<Restriction>()
    if (isBedtimeActive(ruleset.bedtime, nowSeconds, zonesOf(ruleset)) &&
        categoryLevelOf(observation, ruleset.categories, catalog) <= BEDTIME_MAX_LEVEL
    ) {
        restrictions += Restriction(Access.BLOCK, ReasonCode.SCHEDULE_BEDTIME, null, BEDTIME_GROUP)
    }
    val budget = exhaustedBudgetRule(budgetCandidates, state.usage, localDatesAt(ruleset, nowSeconds), catalog)
    if (budget != null) restrictions += Restriction(Access.BLOCK, ReasonCode.BUDGET_EXHAUSTED, budget.id, budget.id)
    if (winner?.mode == AccessMode.BLOCK) {
        restrictions += Restriction(Access.BLOCK, ReasonCode.RULE_MATCH, winner.rule.id, winner.rule.id)
    }
    if (winner?.mode == AccessMode.FRICTION) {
        val frictionRules = access.filter { it.mode == AccessMode.FRICTION }.map { it.rule }
        restrictions +=
            Restriction(
                Access.GATE,
                ReasonCode.INTENTION_REQUIRED,
                winner.rule.id,
                winner.rule.id,
                FrictionRestriction(winner.rule, frictionRules),
            )
    }
    return restrictions
}

private fun accessOutcome(
    inputs: DecisionInputs,
    restrictions: List<Restriction>,
    winner: AccessCandidate?,
): AccessOutcome {
    var firstLift: AccessOutcome? = null
    for (restriction in restrictions) {
        val lift = liftOf(restriction, inputs)
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
                inputs.nowSeconds,
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

internal fun decideOrThrow(
    ruleset: Ruleset,
    observation: Observation,
    state: DecisionState,
    now: String,
    catalog: RulesCatalog,
): Decision {
    val nowSeconds = guardDecisionInputs(ruleset, observation, state, now)
    val resolved = resolveObservation(observation, catalog)
    val inputs = DecisionInputs(ruleset, state, resolved, nowSeconds, catalog)
    val scheduled = scheduledRules(inputs)
    val matching = scheduled.filter { matchesTarget(it.target, resolved, catalog) }
    val unknownPath = hasUnknownPath(resolved)
    // §5.5: with an unknown path every rule of the host's domain and profile competes for access.
    val accessPool =
        if (resolved is ResolvedObservation.Site && unknownPath) {
            scheduled.filter { matchesHostOfUnknownPath(it.target, resolved.host, catalog) }
        } else {
            matching
        }
    val access = accessCandidates(accessPool, resolved, catalog)
    val winner = accessWinner(access, unknownPath, catalog)
    val outcome = accessOutcome(inputs, restrictionsOf(inputs, accessPool, access, winner), winner)
    val content = contentOutcome(matching, resolved, catalog)
    val (reason, ruleId) = primaryOutcome(outcome, content)
    return Decision(
        access = outcome.access,
        content = content.content,
        ruleId = ruleId,
        reason = reason,
        gate = outcome.gate,
        explanationKey = explanationKeyOf(outcome.access, content.content, reason),
    )
}
