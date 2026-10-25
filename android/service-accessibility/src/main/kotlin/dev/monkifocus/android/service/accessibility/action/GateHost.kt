// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.action

import dev.monkifocus.android.feature.gate.state.GateUiState

/**
 * Where a gate screen is shown (plan §2.5, risk 2): in the
 * `TYPE_ACCESSIBILITY_OVERLAY` window, or in `GateActivity` when it needs
 * the keyboard and the overlay cannot be trusted with it.
 *
 * Every screen starts in the overlay except a prompt that requires a typed
 * intention when the overlay's keyboard is known not to work: the device
 * failed the [ImeProbe] before, or it runs API 29, where IME visibility
 * cannot be read from the window insets to check. Prompts with an optional
 * intention stay in the overlay (the user can continue without typing), and
 * the probe still runs there.
 */
enum class GateHost {
    OVERLAY,
    ACTIVITY,
    ;

    companion object {
        /** The first API level whose window insets report IME visibility. */
        const val INSETS_IME_API = 30

        fun choose(
            state: GateUiState,
            apiLevel: Int,
            overlayImeFailed: Boolean,
        ): GateHost {
            val needsTyping = state is GateUiState.Asking && state.requiresTypedIntention
            return if (needsTyping && (overlayImeFailed || apiLevel < INSETS_IME_API)) ACTIVITY else OVERLAY
        }
    }
}
