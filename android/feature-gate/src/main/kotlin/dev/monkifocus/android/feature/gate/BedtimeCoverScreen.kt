// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.feature.gate.state.GateUiState

/**
 * The bedtime cover: limited apps stay closed until the window ends (in the
 * locale's time format), with Close and the emergency footer.
 */
@Composable
fun BedtimeCoverScreen(
    state: GateUiState.BedtimeCover,
    onClose: () -> Unit,
    onEmergency: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    val body =
        state.endMinuteOfDay?.let { stringResource(R.string.bedtime_body_until, rememberLocalTimeText(it)) }
            ?: stringResource(R.string.decision_schedule_bedtime)
    GateLayout(modifier) {
        Text(text = stringResource(R.string.bedtime_title), color = colors.ink1, style = typography.title)
        Text(text = body, color = colors.ink2, style = typography.body)
        GateCloseButton(onClose)
        GateEmergencyFooter(onEmergency)
    }
}
