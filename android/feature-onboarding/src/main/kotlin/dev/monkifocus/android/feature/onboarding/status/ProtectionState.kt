// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.status

/**
 * What the Status screen says about protection:
 *
 * - [ACTIVE]: turned on in the app and the accessibility service is on;
 * - [SERVICE_OFF]: turned on in the app, but the service is off in Settings;
 * - [EXIT_WAITING]: "Exit and unlink" is counting down (still active);
 * - [ENDED]: the exit ended protection; only the app brings it back;
 * - [STATS_ONLY]: the user chose statistics only; nothing is blocked;
 * - [SETUP_UNFINISHED]: protection was never turned on in the app.
 */
enum class ProtectionState {
    ACTIVE,
    SERVICE_OFF,
    EXIT_WAITING,
    ENDED,
    STATS_ONLY,
    SETUP_UNFINISHED,
    ;

    /** Whether the Status screen offers "Turn on protection". */
    val canTurnOn: Boolean get() = this != ACTIVE && this != EXIT_WAITING

    companion object {
        fun of(
            serviceEnabled: Boolean,
            armedByUser: Boolean,
            exitWaiting: Boolean,
            exitEnded: Boolean,
            statsOnly: Boolean,
        ): ProtectionState =
            when {
                exitEnded -> ENDED
                exitWaiting && armedByUser -> EXIT_WAITING
                armedByUser && serviceEnabled -> ACTIVE
                armedByUser -> SERVICE_OFF
                statsOnly -> STATS_ONLY
                else -> SETUP_UNFINISHED
            }
    }
}
