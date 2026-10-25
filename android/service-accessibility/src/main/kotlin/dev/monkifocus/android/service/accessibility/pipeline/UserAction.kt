// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.pipeline

/** What the user did on one of our overlay screens (or in `GateActivity`). */
sealed interface UserAction {
    /** Close on any gate screen, Leave on the timeout card: always available. */
    data object Close : UserAction

    /** Continue with an intention (kept in memory only) and 5, 10 or 15 minutes. */
    class Continue(
        val intention: String,
        val minutes: Int,
    ) : UserAction {
        override fun toString(): String = "Continue(⟨intention⟩, $minutes)"
    }

    data object Emergency : UserAction

    data object CancelEmergency : UserAction

    /** "5 more min" on the timeout card. */
    data object Extend : UserAction

    /** Close on the hide-feed cover: BACK. */
    data object CoverClose : UserAction

    /** "Go back" on the bounce card. */
    data object BounceBack : UserAction

    /** "Disable protection (waits 2 min …)" on the bounce card: starts the exit flow. */
    data object DisableProtection : UserAction

    /** Keep protection: cancels a running exit wait. */
    data object KeepProtection : UserAction

    /** "Open monki-focus" on the setup card. */
    data object OpenApp : UserAction

    /** "Allow notifications" on the notice-off card. */
    data object AllowNotifications : UserAction

    /** Closes a status card. */
    data object DismissCard : UserAction
}
