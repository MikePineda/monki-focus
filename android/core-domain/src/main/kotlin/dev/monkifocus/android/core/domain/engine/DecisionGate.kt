// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.EscalationState
import dev.monkifocus.android.core.domain.rules.FrictionType
import dev.monkifocus.android.core.domain.rules.Gate
import dev.monkifocus.android.core.domain.rules.Rule

/*
 * The gate `decide` returns for a friction restriction without a lift
 * (SEMANTICS.md §7.4):
 *
 * - in `pausing` or `asking`: the winner group's current gate;
 * - in `timed_out` or `override_waiting` (a visit changes nothing there): the
 *   current gate without a new attempt;
 * - otherwise the gate a `visit` would produce now, on the **effective
 *   state**: escalation is shared by every matching friction candidate, so a
 *   new rule id never resets it. Adapters call `nextEscalation` for the
 *   winner's group with that effective state ([effectiveEscalationState]), so
 *   the stored gate equals the returned one.
 */

private fun lastActivitySeconds(state: EscalationState): Long = state.lastActivityAt?.let(::epochSecondsOf) ?: Long.MIN_VALUE

/**
 * The winner group's state with the counters every matching friction group
 * shares: the maxima of the session-checked counters, and the friction type
 * of the group with the latest activity (ties: the winner's, then the
 * smallest rule id).
 */
fun effectiveEscalationState(
    winner: Rule,
    frictionRules: List<Rule>,
    states: List<EscalationState>,
    now: String,
): EscalationState = effectiveEscalationStateAt(winner, frictionRules, states, epochSecondsOf(now))

internal fun effectiveEscalationStateAt(
    winner: Rule,
    frictionRules: List<Rule>,
    states: List<EscalationState>,
    nowSeconds: Long,
): EscalationState {
    val own = escalationStateOf(states, winner.id)
    // Other groups in id order, so a tie between them never depends on rule order.
    val others =
        frictionRules
            .filter { it.id != winner.id }
            .map { it.id }
            .sorted()
            .map { escalationStateOf(states, it) }
    var attemptCount = 0
    var brokenCount = 0
    var latest = own
    for (state in listOf(own) + others) {
        val counters = sessionCounters(state, nowSeconds)
        attemptCount = maxOf(attemptCount, counters.attemptCount)
        brokenCount = maxOf(brokenCount, counters.brokenCount)
        if (lastActivitySeconds(state) > lastActivitySeconds(latest)) latest = state
    }
    // Counters are already session-checked: the visit must not reset them again.
    return own.copy(
        attemptCount = attemptCount,
        brokenCount = brokenCount,
        lastFrictionType = latest.lastFrictionType,
        lastActivityAt = null,
    )
}

internal fun decisionGate(
    winner: Rule,
    frictionRules: List<Rule>,
    states: List<EscalationState>,
    nowSeconds: Long,
    guardianLinked: Boolean,
): Gate {
    val own = escalationStateOf(states, winner.id)
    val storedGate = own.gate
    if ((own.phase == EscalationPhase.PAUSING || own.phase == EscalationPhase.ASKING) && storedGate != null) return storedGate
    if (own.phase == EscalationPhase.TIMED_OUT || own.phase == EscalationPhase.OVERRIDE_WAITING) {
        return fullGate(own.attemptCount, own.brokenCount, own.lastFrictionType ?: FrictionType.COUNTDOWN, guardianLinked)
    }
    val effective = effectiveEscalationStateAt(winner, frictionRules, states, nowSeconds)
    return visitOutcome(effective, nowSeconds, guardianLinked).gate
}
