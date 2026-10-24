// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.EscalationState

/*
 * The escalation session (SEMANTICS.md §7.2): attempts count in a session
 * that resets when a `visit` arrives at least 2 hours after `lastActivityAt`
 * (the last escalation event of any kind). There is no reset at midnight.
 */

internal const val SESSION_QUIET_SECONDS = 7200L

fun initialEscalationState(targetGroup: String): EscalationState =
    EscalationState(
        targetGroup = targetGroup,
        phase = EscalationPhase.IDLE,
        attemptCount = 0,
        lastAttemptAt = null,
        lastActivityAt = null,
        brokenCount = 0,
        lastFrictionType = null,
        gate = null,
        pauseEndsAt = null,
        pendingExtension = false,
        intentionExpiresAt = null,
        overrideReadyAt = null,
        overrideEndsAt = null,
    )

/** The stored state of a group, or the initial idle state when the group has none. */
internal fun escalationStateOf(
    states: List<EscalationState>,
    targetGroup: String,
): EscalationState = states.firstOrNull { it.targetGroup == targetGroup } ?: initialEscalationState(targetGroup)

internal data class SessionCounters(
    val attemptCount: Int,
    val brokenCount: Int,
)

/** Counters a visit at `nowSeconds` starts from: zero after two quiet hours. */
internal fun sessionCounters(
    state: EscalationState,
    nowSeconds: Long,
): SessionCounters {
    val lastActivityAt = state.lastActivityAt
    val quiet = lastActivityAt != null && nowSeconds - epochSecondsOf(lastActivityAt) >= SESSION_QUIET_SECONDS
    return if (quiet) SessionCounters(0, 0) else SessionCounters(state.attemptCount, state.brokenCount)
}
