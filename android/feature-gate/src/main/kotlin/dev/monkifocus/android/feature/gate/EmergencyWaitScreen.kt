// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.components.MonkiCountdown
import dev.monkifocus.android.core.ui.components.MonkiProgressLine
import dev.monkifocus.android.core.ui.components.MonkiSecondaryButton
import dev.monkifocus.android.core.ui.theme.MonkiRadius
import dev.monkifocus.android.core.ui.theme.MonkiSpacing
import dev.monkifocus.android.feature.gate.state.GateUiState

/**
 * The emergency wait: a 2:00 countdown, the neutral notice that the guardian
 * will be told (or that it is recorded, without a guardian), Close and
 * "Cancel emergency".
 */
@Composable
fun EmergencyWaitScreen(
    state: GateUiState.EmergencyWait,
    onClose: () -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    GateLayout(modifier) { compact ->
        GateContextLine(state.targetLabel)
        Text(text = stringResource(R.string.gate_emergency), color = colors.ink1, style = typography.title)
        MonkiCountdown(
            remainingSeconds = state.remainingSeconds,
            modifier = Modifier.testTag(GateTestTags.COUNTDOWN),
            compact = compact,
        )
        MonkiProgressLine(progress = state.progress, modifier = Modifier.testTag(GateTestTags.PROGRESS))
        Text(text = stringResource(R.string.gate_emergency_wait_body), color = colors.ink2, style = typography.body)
        Text(
            text =
                stringResource(
                    if (state.guardianLinked) R.string.gate_emergency_guardian_notice else R.string.gate_emergency_recorded_notice,
                ),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(colors.surface2, RoundedCornerShape(MonkiRadius.radiusLg))
                    .padding(MonkiSpacing.spaceMd),
            color = colors.ink1,
            style = typography.bodySm,
        )
        GateCloseButton(onClose)
        MonkiSecondaryButton(
            text = stringResource(R.string.gate_emergency_cancel),
            onClick = onCancel,
            modifier = Modifier.testTag(GateTestTags.CANCEL_EMERGENCY),
        )
    }
}
