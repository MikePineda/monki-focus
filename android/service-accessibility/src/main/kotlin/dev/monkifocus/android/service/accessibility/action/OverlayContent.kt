// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.action

import dev.monkifocus.android.detectors.GuardedScreen
import dev.monkifocus.android.feature.gate.state.GateUiState

/** What our overlay window shows. Pure data: the platform renders it with the `:feature-gate` and own screens. */
sealed interface OverlayContent {
    /**
     * A gate screen of `:feature-gate`. [group] is the escalation group the
     * screen's actions apply to (null for an engine error: nothing can lift
     * it). A [notice] follows a BACK from a blocked surface: Close only
     * dismisses it, and it stays while the user is in the same app.
     */
    data class Gate(
        val state: GateUiState,
        val group: String?,
        val notice: Boolean = false,
    ) : OverlayContent

    /** The hide-feed cover over [region]; the bars around it stay usable. */
    data class Cover(
        val region: CoverRegion,
    ) : OverlayContent

    /**
     * The visible bounce card over one of our own Settings screens: what the
     * screen would undo and the way out ("Disable protection", the 2-minute
     * exit). [exitRemainingSeconds] is set while the exit wait runs.
     */
    data class Bounce(
        val screen: GuardedScreen,
        val exitRemainingSeconds: Int?,
        val guardianLinked: Boolean,
    ) : OverlayContent
}
