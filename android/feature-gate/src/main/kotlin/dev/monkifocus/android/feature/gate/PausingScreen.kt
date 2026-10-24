// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import dev.monkifocus.android.core.domain.rules.FrictionType
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.components.MonkiCountdown
import dev.monkifocus.android.core.ui.components.MonkiProgressLine
import dev.monkifocus.android.feature.gate.state.GateUiState

/**
 * The pause (DESIGN.md §Interstitial 2–3): the big countdown, or the breath
 * circle for a breath pause, the 1 dp progress line and the "why" line of
 * the pause type, then Close (enabled from the first frame) and the
 * emergency footer.
 */
@Composable
fun PausingScreen(
    state: GateUiState.Pausing,
    onClose: () -> Unit,
    onEmergency: () -> Unit,
    modifier: Modifier = Modifier,
) {
    GateLayout(modifier) { compact ->
        GateContextLine(state.targetLabel)
        if (state.frictionType == FrictionType.BREATH) {
            BreathPause(elapsedSeconds = state.elapsedSeconds, remainingSeconds = state.remainingSeconds)
        } else {
            MonkiCountdown(
                remainingSeconds = state.remainingSeconds,
                modifier = Modifier.testTag(GateTestTags.COUNTDOWN),
                compact = compact,
            )
        }
        MonkiProgressLine(progress = state.progress, modifier = Modifier.testTag(GateTestTags.PROGRESS))
        Text(
            text = stringResource(whyTextRes(state.frictionType)),
            color = MonkiTheme.colors.ink2,
            style = MonkiTheme.typography.body,
        )
        GateCloseButton(onClose)
        GateLevelLine(state.level)
        GateEmergencyFooter(onEmergency)
    }
}
