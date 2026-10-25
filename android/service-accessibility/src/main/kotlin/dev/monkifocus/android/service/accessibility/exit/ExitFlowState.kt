// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.exit

/** Where "Exit and unlink" stands. Instants are wall-clock epoch milliseconds. */
sealed interface ExitFlowState {
    /** Protection is on: the guards bounce our own Settings screens (always with a visible way out). */
    data object Armed : ExitFlowState

    /** The user asked to leave at [requestedAtMs]; protection ends [ExitFlow.WAIT_MS] later. */
    data class Waiting(
        val requestedAtMs: Long,
    ) : ExitFlowState

    /** Protection ended at [endedAtMs]: no guard, no device admin, no enforcement. */
    data class Ended(
        val endedAtMs: Long,
    ) : ExitFlowState
}
