// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate.state

import dev.monkifocus.android.core.domain.rules.ExplanationKey
import dev.monkifocus.android.core.domain.rules.FrictionType

/**
 * What the gate overlay shows, derived by [GateUiStateMapper] from the
 * engine decision and the escalation state. Pure data: no text (the screens
 * resolve string resources), no Android types. [targetLabel] is data (an app
 * label or a domain), never catalog copy.
 */
sealed interface GateUiState {
    /** Nothing to show: access is allowed. */
    data object Hidden : GateUiState

    /** The pause before the intention prompt (countdown, breath, reflect or type-intention). */
    data class Pausing(
        val targetLabel: String,
        val level: Int,
        val frictionType: FrictionType,
        val pauseSeconds: Int,
        val remainingSeconds: Int,
    ) : GateUiState {
        /** How much of the pause is over, 0…1, for the progress line. */
        val progress: Float
            get() = if (pauseSeconds <= 0) 1f else ((pauseSeconds - remainingSeconds).toFloat() / pauseSeconds).coerceIn(0f, 1f)

        /** Seconds since the pause started; drives the breath rhythm. */
        val elapsedSeconds: Int
            get() = (pauseSeconds - remainingSeconds).coerceAtLeast(0)
    }

    /** "What are you here for?": intention (required from L2) and a 5/10/15 duration with no default. */
    data class Asking(
        val targetLabel: String,
        val level: Int,
        val requiresTypedIntention: Boolean,
        val requiresGuardianKey: Boolean,
        val previousIntention: String? = null,
    ) : GateUiState

    /** A block (rule, budget or fail-closed engine error): only Close and, when it can help, Emergency. */
    data class Blocked(
        val targetLabel: String,
        val explanationKey: ExplanationKey,
        val emergencyAvailable: Boolean,
    ) : GateUiState

    /** The 2:00 emergency wait before an override; it can be cancelled. */
    data class EmergencyWait(
        val targetLabel: String,
        val remainingSeconds: Int,
        val guardianLinked: Boolean,
        val waitSeconds: Int = GateUiStateMapper.EMERGENCY_WAIT_SECONDS,
    ) : GateUiState {
        val progress: Float
            get() = if (waitSeconds <= 0) 1f else ((waitSeconds - remainingSeconds).toFloat() / waitSeconds).coerceIn(0f, 1f)
    }

    /** The intention ran out: Leave, or 5 more minutes that count as a broken intention. */
    data class Timeout(
        val targetLabel: String,
        val intention: String?,
        val minutes: Int?,
        val extensionMinutes: Int,
        val nextPauseSeconds: Int,
    ) : GateUiState

    /** Bedtime is on: limited apps stay covered until [endMinuteOfDay] (local, 0…1439) when known. */
    data class BedtimeCover(
        val endMinuteOfDay: Int?,
    ) : GateUiState
}
