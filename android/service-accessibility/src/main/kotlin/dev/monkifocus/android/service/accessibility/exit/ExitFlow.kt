// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.exit

/**
 * "Exit and unlink" (plan 04 §2, conciliation rule 5): leaving is always
 * possible from the device, deliberate and visible, never instant and never
 * blocked. It does not consult the decision engine at all, so an
 * `engine_error` (which blocks every target) can never stand in its way.
 *
 * - [request] starts a [WAIT_MS] wait (asking again does not restart it);
 * - [cancel] keeps protection;
 * - [tick] ends it once the wait is over, with [ExitFlowEffect]s: the
 *   neutral `protection_ended` event, device admin disarmed, enforcement and
 *   the service stopped;
 * - a wall clock set back behind the request restarts the wait from now,
 *   so it never grows longer than two minutes of the current clock;
 * - [rearm] after the user turned the service on again.
 *
 * Pure: every transition answers the next state and its effects.
 */
object ExitFlow {
    const val WAIT_MS = 120_000L

    data class Transition(
        val state: ExitFlowState,
        val effects: List<ExitFlowEffect> = emptyList(),
    )

    fun request(
        state: ExitFlowState,
        nowMs: Long,
    ): Transition =
        when (state) {
            ExitFlowState.Armed -> Transition(ExitFlowState.Waiting(nowMs))
            is ExitFlowState.Waiting, is ExitFlowState.Ended -> Transition(state)
        }

    fun cancel(state: ExitFlowState): Transition =
        if (state is ExitFlowState.Waiting) Transition(ExitFlowState.Armed) else Transition(state)

    fun tick(
        state: ExitFlowState,
        nowMs: Long,
    ): Transition {
        if (state !is ExitFlowState.Waiting) return Transition(state)
        if (nowMs < state.requestedAtMs) return Transition(ExitFlowState.Waiting(nowMs))
        if (nowMs - state.requestedAtMs < WAIT_MS) return Transition(state)
        return Transition(ExitFlowState.Ended(nowMs), ENDING_EFFECTS)
    }

    fun rearm(state: ExitFlowState): Transition = if (state is ExitFlowState.Ended) Transition(ExitFlowState.Armed) else Transition(state)

    /** Whole seconds left in the wait (rounded up), or null when not waiting. */
    fun remainingSeconds(
        state: ExitFlowState,
        nowMs: Long,
    ): Int? {
        if (state !is ExitFlowState.Waiting) return null
        val left = (WAIT_MS - (nowMs - state.requestedAtMs)).coerceIn(0, WAIT_MS)
        return ((left + MILLIS_PER_SECOND - 1) / MILLIS_PER_SECOND).toInt()
    }

    private const val MILLIS_PER_SECOND = 1_000L

    private val ENDING_EFFECTS =
        listOf(ExitFlowEffect.RECORD_PROTECTION_ENDED, ExitFlowEffect.DISARM_DEVICE_ADMIN, ExitFlowEffect.STOP_PROTECTION)
}
