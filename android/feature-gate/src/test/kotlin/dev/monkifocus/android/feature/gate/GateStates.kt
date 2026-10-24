// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import dev.monkifocus.android.core.domain.rules.ExplanationKey
import dev.monkifocus.android.core.domain.rules.FrictionType
import dev.monkifocus.android.feature.gate.state.GateUiState

/** Synthetic gate states for the screen tests. */
internal const val TARGET = "example.com"

internal fun pausing(
    remainingSeconds: Int = 15,
    pauseSeconds: Int = 15,
    frictionType: FrictionType = FrictionType.COUNTDOWN,
    level: Int = 1,
) = GateUiState.Pausing(TARGET, level, frictionType, pauseSeconds, remainingSeconds)

internal fun asking(
    level: Int = 1,
    requiresTypedIntention: Boolean = level >= 2,
    requiresGuardianKey: Boolean = false,
    previousIntention: String? = null,
) = GateUiState.Asking(TARGET, level, requiresTypedIntention, requiresGuardianKey, previousIntention)

internal fun blocked(
    key: ExplanationKey = ExplanationKey.BUDGET_EXHAUSTED,
    emergencyAvailable: Boolean = key != ExplanationKey.ENGINE_ERROR,
) = GateUiState.Blocked(TARGET, key, emergencyAvailable)

internal fun emergencyWait(
    remainingSeconds: Int = 120,
    guardianLinked: Boolean = true,
) = GateUiState.EmergencyWait(TARGET, remainingSeconds, guardianLinked)

internal fun timeout(
    intention: String? = "reply to one message",
    minutes: Int? = 10,
) = GateUiState.Timeout(TARGET, intention, minutes, extensionMinutes = 5, nextPauseSeconds = 30)

internal fun bedtime(endMinuteOfDay: Int? = 420) = GateUiState.BedtimeCover(endMinuteOfDay)

/** Every screen the overlay can show (all but Hidden). */
internal fun everyGateScreen(): List<GateUiState> =
    listOf(
        pausing(),
        pausing(frictionType = FrictionType.BREATH),
        asking(),
        asking(level = 3, requiresGuardianKey = true),
        blocked(),
        blocked(ExplanationKey.ENGINE_ERROR),
        emergencyWait(),
        timeout(),
        bedtime(),
    )
