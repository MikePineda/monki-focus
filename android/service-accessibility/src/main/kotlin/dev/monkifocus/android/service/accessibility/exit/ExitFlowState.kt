// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.exit

/** Where "Exit and unlink" stands. */
sealed interface ExitFlowState {
    /** Protection is on: the guards bounce our own Settings screens (always with a visible way out). */
    data object Armed : ExitFlowState

    /**
     * The user asked to leave at monotonic [requestedAtMs] of boot [boot];
     * protection ends [ExitFlow.WAIT_MS] of monotonic time later, in the same
     * boot (a reboot restarts the wait, setting the wall clock does nothing).
     */
    data class Waiting(
        val requestedAtMs: Long,
        val boot: Int,
    ) : ExitFlowState

    /**
     * Protection ended at wall time [endedAtMs]: no guard, no device admin,
     * no enforcement. The service turns itself off whenever it is turned on
     * again, unless the user asked our app to bring protection back
     * ([rearmAllowed]).
     */
    data class Ended(
        val endedAtMs: Long,
        val rearmAllowed: Boolean = false,
    ) : ExitFlowState
}
