// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import dev.monkifocus.android.core.domain.rules.ExplanationKey
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.feature.gate.state.GateUiState

/**
 * A block (a block rule, a spent budget or the fail-closed engine error):
 * the title, the explanation of the engine's key, Close and, unless nothing
 * could lift it, the emergency footer. Nothing else.
 */
@Composable
fun BlockedScreen(
    state: GateUiState.Blocked,
    onClose: () -> Unit,
    onEmergency: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    val title =
        when (state.explanationKey) {
            ExplanationKey.BUDGET_EXHAUSTED -> R.string.gate_blocked_title_budget
            ExplanationKey.ENGINE_ERROR -> R.string.gate_blocked_title_error
            else -> R.string.gate_blocked_title_rule
        }
    GateLayout(modifier) {
        Text(text = stringResource(title, state.targetLabel), color = colors.ink1, style = typography.title)
        Text(text = stringResource(explanationTextRes(state.explanationKey)), color = colors.ink2, style = typography.body)
        GateCloseButton(onClose)
        if (state.emergencyAvailable) {
            GateEmergencyFooter(onEmergency)
        }
    }
}
