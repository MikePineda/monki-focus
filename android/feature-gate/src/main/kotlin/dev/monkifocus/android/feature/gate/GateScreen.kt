// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import dev.monkifocus.android.feature.gate.state.GateUiState

/**
 * The gate overlay's root: one screen per [GateUiState]. The only local state
 * is the intention draft (text and minutes), kept across configuration
 * changes; everything else comes from [state].
 */
@Composable
fun GateScreen(
    state: GateUiState,
    actions: GateActions,
    modifier: Modifier = Modifier,
) {
    when (state) {
        // Access is allowed: the overlay shows nothing.
        GateUiState.Hidden -> {}

        is GateUiState.Pausing -> {
            PausingScreen(state, actions.onClose, actions.onEmergency, modifier)
        }

        is GateUiState.Asking -> {
            var intention by rememberSaveable { mutableStateOf("") }
            var minutes by rememberSaveable { mutableStateOf<Int?>(null) }
            AskingScreen(
                state = state,
                intention = intention,
                minutes = minutes,
                onIntentionChange = { intention = it },
                onMinutesChange = { minutes = it },
                onContinue = actions.onContinue,
                onClose = actions.onClose,
                onEmergency = actions.onEmergency,
                modifier = modifier,
            )
        }

        is GateUiState.Blocked -> {
            BlockedScreen(state, actions.onClose, actions.onEmergency, modifier)
        }

        is GateUiState.EmergencyWait -> {
            EmergencyWaitScreen(state, actions.onClose, actions.onCancelEmergency, modifier)
        }

        is GateUiState.Timeout -> {
            TimeoutScreen(state, actions.onClose, actions.onExtend, modifier)
        }

        is GateUiState.BedtimeCover -> {
            BedtimeCoverScreen(state, actions.onClose, actions.onEmergency, modifier)
        }
    }
}
