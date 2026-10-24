// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate.state

import dev.monkifocus.android.core.domain.engine.epochSecondsOf
import dev.monkifocus.android.core.domain.rules.Access
import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.ExplanationKey
import dev.monkifocus.android.core.domain.rules.Gate
import dev.monkifocus.android.core.domain.rules.ReasonCode

/**
 * Turns an engine [dev.monkifocus.android.core.domain.rules.Decision] plus
 * the escalation state of its group into the [GateUiState] the overlay
 * shows (SEMANTICS.md §5, §7). Pure: the clock is an input. It fails closed:
 * a gate decision without a gate shows the engine-error block.
 */
object GateUiStateMapper {
    /** `emergency_request` → `override_waiting` lasts 120 s (SEMANTICS.md §7.3). */
    const val EMERGENCY_WAIT_SECONDS = 120

    /** An extension after a timeout gives 5 more minutes (SEMANTICS.md §7.3 `extend`). */
    const val EXTENSION_MINUTES = 5

    private const val MAX_PAUSE_SECONDS = 60

    fun map(input: GateInput): GateUiState {
        val decision = input.decision
        return when (decision.access) {
            Access.ALLOW -> GateUiState.Hidden
            Access.BLOCK -> blocked(input)
            Access.GATE -> decision.gate?.let { gated(input, it) } ?: engineError(input)
        }
    }

    private fun blocked(input: GateInput): GateUiState {
        val decision = input.decision
        if (decision.reason == ReasonCode.ENGINE_ERROR) return engineError(input)
        if (input.escalation?.phase == EscalationPhase.OVERRIDE_WAITING) return emergencyWait(input)
        if (decision.reason == ReasonCode.SCHEDULE_BEDTIME) {
            return GateUiState.BedtimeCover(input.bedtimeEndMinuteOfDay?.takeIf { it in 0 until MINUTES_PER_DAY })
        }
        return GateUiState.Blocked(input.targetLabel, decision.explanationKey, emergencyAvailable = true)
    }

    private fun gated(
        input: GateInput,
        gate: Gate,
    ): GateUiState {
        // No state stored yet: the visit starts a full pause.
        val escalation = input.escalation ?: return pausing(input, gate, gate.pauseSeconds)
        return when (escalation.phase) {
            EscalationPhase.OVERRIDE_WAITING -> {
                emergencyWait(input)
            }

            EscalationPhase.TIMED_OUT -> {
                timeout(input, gate)
            }

            EscalationPhase.ASKING -> {
                asking(input, gate)
            }

            EscalationPhase.PAUSING -> {
                val remaining =
                    secondsUntil(escalation.pauseEndsAt, input.nowEpochSeconds)?.coerceIn(0, gate.pauseSeconds)
                        ?: gate.pauseSeconds
                // The short extension path goes straight to `active` when its pause ends: no prompt.
                if (remaining > 0 || escalation.pendingExtension) pausing(input, gate, remaining) else asking(input, gate)
            }

            // Idle, or an intention or override that ran out: the visit starts a full pause.
            EscalationPhase.IDLE, EscalationPhase.ACTIVE, EscalationPhase.OVERRIDE_ACTIVE -> {
                pausing(input, gate, gate.pauseSeconds)
            }
        }
    }

    private fun pausing(
        input: GateInput,
        gate: Gate,
        remainingSeconds: Int,
    ) = GateUiState.Pausing(
        targetLabel = input.targetLabel,
        level = gate.level,
        frictionType = gate.frictionType,
        pauseSeconds = gate.pauseSeconds,
        remainingSeconds = remainingSeconds,
    )

    private fun asking(
        input: GateInput,
        gate: Gate,
    ) = GateUiState.Asking(
        targetLabel = input.targetLabel,
        level = gate.level,
        requiresTypedIntention = gate.requiresTypedIntention,
        requiresGuardianKey = gate.requiresGuardianKey,
        previousIntention = input.previousIntention?.takeIf { it.isNotBlank() },
    )

    /** After `extend` the pause doubles (`brokenCount + 1`), capped at 60 s (SEMANTICS.md §7.1). */
    private fun timeout(
        input: GateInput,
        gate: Gate,
    ) = GateUiState.Timeout(
        targetLabel = input.targetLabel,
        intention = input.timedOutIntention?.trim()?.takeIf { it.isNotEmpty() },
        minutes = input.timedOutMinutes?.takeIf { it > 0 },
        extensionMinutes = EXTENSION_MINUTES,
        nextPauseSeconds = minOf(gate.pauseSeconds * 2, MAX_PAUSE_SECONDS),
    )

    private fun emergencyWait(input: GateInput): GateUiState {
        val remaining =
            secondsUntil(input.escalation?.overrideReadyAt, input.nowEpochSeconds)?.coerceIn(0, EMERGENCY_WAIT_SECONDS)
                ?: EMERGENCY_WAIT_SECONDS
        return GateUiState.EmergencyWait(input.targetLabel, remaining, input.guardianLinked)
    }

    /** Fail closed: nothing lifts an engine error, so Emergency is not offered. */
    private fun engineError(input: GateInput) =
        GateUiState.Blocked(input.targetLabel, ExplanationKey.ENGINE_ERROR, emergencyAvailable = false)

    /** Whole seconds from now until [instant]; null when it is missing or not a valid instant. */
    private fun secondsUntil(
        instant: String?,
        nowEpochSeconds: Long,
    ): Int? {
        if (instant == null) return null
        val end = runCatching { epochSecondsOf(instant) }.getOrNull() ?: return null
        return (end - nowEpochSeconds).coerceIn(Int.MIN_VALUE.toLong(), Int.MAX_VALUE.toLong()).toInt()
    }

    private const val MINUTES_PER_DAY = 24 * 60
}
