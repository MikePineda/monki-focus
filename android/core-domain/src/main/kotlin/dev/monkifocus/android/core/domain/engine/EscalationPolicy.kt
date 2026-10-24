// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.EscalationEffect
import dev.monkifocus.android.core.domain.rules.EscalationEvent
import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.EscalationState
import dev.monkifocus.android.core.domain.rules.Gate
import kotlinx.serialization.Serializable

/*
 * `nextEscalation(state, event, now, guardianLinked) → {state, effects}`
 * (SEMANTICS.md §7.3). One state per target group. An event that does not
 * apply in the current phase leaves the state unchanged; every event that
 * changes it sets `lastActivityAt = now`.
 */

/** The next state of a group and what the adapter must do (`escalation-fixture.schema.json` step `then`). */
@Serializable
data class EscalationResult(
    val state: EscalationState,
    val effects: List<EscalationEffect>,
)

/** An intention of an extension (§7.3 `pause_elapsed` with `pendingExtension`). */
private const val EXTENSION_SECONDS = 300L

/** Emergency override: wait, then grant (§7.3). */
private const val OVERRIDE_WAIT_SECONDS = 120L
private const val OVERRIDE_SECONDS = 15 * 60L

/** A typed intention needs at least this many words (§7.3 `commit`). */
private const val MIN_TYPED_WORDS = 3

/** Whether a timer has run out at `now` (a missing timer counts as run out). */
private fun hasPassed(
    timer: String?,
    nowSeconds: Long,
): Boolean = timer == null || nowSeconds >= epochSecondsOf(timer)

private fun EscalationState.toIdle(): EscalationState =
    copy(
        phase = EscalationPhase.IDLE,
        gate = null,
        pauseEndsAt = null,
        pendingExtension = false,
        intentionExpiresAt = null,
        overrideReadyAt = null,
        overrideEndsAt = null,
    )

internal data class VisitOutcome(
    val attemptCount: Int,
    val brokenCount: Int,
    val gate: Gate,
)

/** Session check, one more attempt and the next gate: what a `visit` counts (§7.2, §7.3). */
internal fun visitOutcome(
    state: EscalationState,
    nowSeconds: Long,
    guardianLinked: Boolean,
): VisitOutcome {
    val counters = sessionCounters(state, nowSeconds)
    val attemptCount = minOf(counters.attemptCount + 1, MAX_ATTEMPT_COUNT)
    val gate = fullGate(attemptCount, counters.brokenCount, nextFrictionType(state.lastFrictionType), guardianLinked)
    return VisitOutcome(attemptCount, counters.brokenCount, gate)
}

/** The state a `visit` produces in a phase that accepts one (§7.3 `visit`). */
private fun visitedState(
    state: EscalationState,
    nowSeconds: Long,
    guardianLinked: Boolean,
): EscalationState {
    val (attemptCount, brokenCount, gate) = visitOutcome(state, nowSeconds, guardianLinked)
    return state.toIdle().copy(
        phase = EscalationPhase.PAUSING,
        attemptCount = attemptCount,
        brokenCount = brokenCount,
        lastAttemptAt = utcInstantOf(nowSeconds),
        lastFrictionType = gate.frictionType,
        gate = gate,
        pauseEndsAt = utcInstantOf(nowSeconds + gate.pauseSeconds),
    )
}

/** Whether a `visit` starts a new attempt in this state (§7.3: reloading never resets a pause). */
internal fun acceptsVisit(
    state: EscalationState,
    nowSeconds: Long,
): Boolean =
    when (state.phase) {
        EscalationPhase.IDLE -> true
        EscalationPhase.ACTIVE -> hasPassed(state.intentionExpiresAt, nowSeconds)
        EscalationPhase.OVERRIDE_ACTIVE -> hasPassed(state.overrideEndsAt, nowSeconds)
        else -> false
    }

private fun extended(
    state: EscalationState,
    nowSeconds: Long,
    guardianLinked: Boolean,
): EscalationState {
    val brokenCount = minOf(state.brokenCount + 1, MAX_BROKEN_COUNT)
    val frictionType = nextFrictionType(state.lastFrictionType)
    val short = state.brokenCount < 2
    val gate =
        if (short) {
            extensionGate(state.attemptCount, brokenCount, frictionType, guardianLinked)
        } else {
            fullGate(state.attemptCount, brokenCount, frictionType, guardianLinked)
        }
    return state.copy(
        phase = EscalationPhase.PAUSING,
        brokenCount = brokenCount,
        lastFrictionType = frictionType,
        gate = gate,
        pauseEndsAt = utcInstantOf(nowSeconds + gate.pauseSeconds),
        pendingExtension = short,
        intentionExpiresAt = null,
    )
}

private fun committed(
    state: EscalationState,
    event: EscalationEvent.Commit,
    nowSeconds: Long,
): EscalationState? {
    if (state.gate?.requiresTypedIntention == true && event.typedWords < MIN_TYPED_WORDS) return null
    if (state.gate?.requiresGuardianKey == true && !event.guardianKeyVerified) return null
    return state.copy(
        phase = EscalationPhase.ACTIVE,
        gate = null,
        pauseEndsAt = null,
        intentionExpiresAt = utcInstantOf(nowSeconds + event.minutes * 60L),
    )
}

/** The next state, or null when the event does not apply in the current phase. */
private fun transition(
    state: EscalationState,
    event: EscalationEvent,
    nowSeconds: Long,
    guardianLinked: Boolean,
): EscalationState? {
    val phase = state.phase
    return when (event) {
        EscalationEvent.Visit -> {
            if (acceptsVisit(state, nowSeconds)) visitedState(state, nowSeconds, guardianLinked) else null
        }

        EscalationEvent.PauseElapsed -> {
            when {
                phase != EscalationPhase.PAUSING || !hasPassed(state.pauseEndsAt, nowSeconds) -> {
                    null
                }

                state.pendingExtension -> {
                    state.copy(
                        phase = EscalationPhase.ACTIVE,
                        gate = null,
                        pauseEndsAt = null,
                        pendingExtension = false,
                        intentionExpiresAt = utcInstantOf(nowSeconds + EXTENSION_SECONDS),
                    )
                }

                else -> {
                    state.copy(phase = EscalationPhase.ASKING)
                }
            }
        }

        EscalationEvent.Close -> {
            if (phase in setOf(EscalationPhase.PAUSING, EscalationPhase.ASKING, EscalationPhase.OVERRIDE_WAITING)) state.toIdle() else null
        }

        is EscalationEvent.Commit -> {
            if (phase == EscalationPhase.ASKING) committed(state, event, nowSeconds) else null
        }

        EscalationEvent.IntentionExpired -> {
            if (phase == EscalationPhase.ACTIVE && hasPassed(state.intentionExpiresAt, nowSeconds)) {
                state.copy(phase = EscalationPhase.TIMED_OUT)
            } else {
                null
            }
        }

        EscalationEvent.Leave -> {
            if (phase == EscalationPhase.ACTIVE || phase == EscalationPhase.TIMED_OUT) state.toIdle() else null
        }

        EscalationEvent.Extend -> {
            if (phase == EscalationPhase.TIMED_OUT) extended(state, nowSeconds, guardianLinked) else null
        }

        // Every phase in which `decide` can gate or block: the user is never trapped.
        EscalationEvent.EmergencyRequest -> {
            if (phase in EMERGENCY_REQUEST_PHASES) {
                state.copy(
                    phase = EscalationPhase.OVERRIDE_WAITING,
                    overrideReadyAt = utcInstantOf(nowSeconds + OVERRIDE_WAIT_SECONDS),
                    intentionExpiresAt = if (phase == EscalationPhase.ACTIVE) null else state.intentionExpiresAt,
                )
            } else {
                null
            }
        }

        EscalationEvent.EmergencyWaitElapsed -> {
            if (phase == EscalationPhase.OVERRIDE_WAITING && hasPassed(state.overrideReadyAt, nowSeconds)) {
                state.copy(phase = EscalationPhase.OVERRIDE_ACTIVE, overrideEndsAt = utcInstantOf(nowSeconds + OVERRIDE_SECONDS))
            } else {
                null
            }
        }

        EscalationEvent.EmergencyExpired -> {
            if (phase == EscalationPhase.OVERRIDE_ACTIVE && hasPassed(state.overrideEndsAt, nowSeconds)) state.toIdle() else null
        }
    }
}

private val EMERGENCY_REQUEST_PHASES =
    setOf(EscalationPhase.IDLE, EscalationPhase.PAUSING, EscalationPhase.ASKING, EscalationPhase.ACTIVE, EscalationPhase.TIMED_OUT)

fun nextEscalation(
    state: EscalationState,
    event: EscalationEvent,
    now: String,
    guardianLinked: Boolean,
): EscalationResult {
    val nowSeconds = epochSecondsOf(now)
    val next = transition(state, event, nowSeconds, guardianLinked) ?: return EscalationResult(state, emptyList())
    val effects = if (event == EscalationEvent.EmergencyWaitElapsed) listOf(EscalationEffect.RECORD_BYPASS) else emptyList()
    return EscalationResult(next.copy(lastActivityAt = utcInstantOf(nowSeconds)), effects)
}
