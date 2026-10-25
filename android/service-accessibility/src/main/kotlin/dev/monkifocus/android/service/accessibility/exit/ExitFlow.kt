// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.exit

/**
 * "Exit and unlink" (plan 04 §2, conciliation rule 5): leaving is always
 * possible from the device, deliberate and visible, never instant and never
 * blocked. It does not consult the decision engine at all, so an
 * `engine_error` (which blocks every target) can never stand in its way.
 *
 * - [request] starts a [WAIT_MS] wait on the monotonic clock (asking again
 *   does not restart it). Setting the wall clock cannot shorten it; a reboot
 *   (another boot count, or a monotonic reading behind the request) restarts
 *   it from now;
 * - [cancel] keeps protection;
 * - [tick] ends it once the wait is over, with [ExitFlowEffect]s: the
 *   neutral `protection_ended` event, device admin disarmed, enforcement and
 *   the service stopped;
 * - after the end, a service that is turned on again turns itself off
 *   ([connect] → [ServiceStart.DISABLE]), so a setting flipped back by
 *   accident or by someone else cannot undo the exit; only [allowRearm],
 *   which the user triggers from our own app, lets the next start re-arm.
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
        now: ExitTime,
    ): Transition =
        when (state) {
            ExitFlowState.Armed -> Transition(ExitFlowState.Waiting(now.monotonicMs, now.boot))
            is ExitFlowState.Waiting, is ExitFlowState.Ended -> Transition(state)
        }

    fun cancel(state: ExitFlowState): Transition =
        if (state is ExitFlowState.Waiting) Transition(ExitFlowState.Armed) else Transition(state)

    fun tick(
        state: ExitFlowState,
        now: ExitTime,
    ): Transition {
        if (state !is ExitFlowState.Waiting) return Transition(state)
        if (now.boot != state.boot || now.monotonicMs < state.requestedAtMs) {
            return Transition(ExitFlowState.Waiting(now.monotonicMs, now.boot))
        }
        if (now.monotonicMs - state.requestedAtMs < WAIT_MS) return Transition(state)
        return Transition(ExitFlowState.Ended(now.wallMs), ENDING_EFFECTS)
    }

    /** The user asked our app to bring protection back after an exit. */
    fun allowRearm(state: ExitFlowState): Transition =
        if (state is ExitFlowState.Ended) Transition(state.copy(rearmAllowed = true)) else Transition(state)

    /** The system bound the service: run, re-arm when the user allowed it, or turn off again. */
    fun connect(state: ExitFlowState): Pair<Transition, ServiceStart> =
        when {
            state is ExitFlowState.Ended && state.rearmAllowed -> Transition(ExitFlowState.Armed) to ServiceStart.RUN
            state is ExitFlowState.Ended -> Transition(state) to ServiceStart.DISABLE
            else -> Transition(state) to ServiceStart.RUN
        }

    /** Whole seconds left in the wait (rounded up), or null when not waiting. */
    fun remainingSeconds(
        state: ExitFlowState,
        now: ExitTime,
    ): Int? {
        if (state !is ExitFlowState.Waiting) return null
        val elapsed = if (now.boot != state.boot || now.monotonicMs < state.requestedAtMs) 0 else now.monotonicMs - state.requestedAtMs
        val left = (WAIT_MS - elapsed).coerceIn(0, WAIT_MS)
        return ((left + MILLIS_PER_SECOND - 1) / MILLIS_PER_SECOND).toInt()
    }

    private const val MILLIS_PER_SECOND = 1_000L

    private val ENDING_EFFECTS =
        listOf(ExitFlowEffect.RECORD_PROTECTION_ENDED, ExitFlowEffect.DISARM_DEVICE_ADMIN, ExitFlowEffect.STOP_PROTECTION)
}
