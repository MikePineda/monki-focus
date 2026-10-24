// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.components.MonkiOverlayCard
import dev.monkifocus.android.core.ui.components.MonkiSecondaryButton
import dev.monkifocus.android.feature.gate.state.GateUiState

/**
 * The timeout card over the scrim: "Your 10 min for “…” are up.", Leave
 * (the accent, focused first) and "5 more min" with its cost note: it
 * counts as a broken intention and the next pause doubles.
 */
@Composable
fun TimeoutScreen(
    state: GateUiState.Timeout,
    onLeave: () -> Unit,
    onExtend: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    val title =
        when {
            state.minutes != null && state.intention != null -> {
                stringResource(R.string.timeout_title_with_intention, state.minutes, state.intention)
            }

            state.minutes != null -> {
                stringResource(R.string.timeout_title_minutes, state.minutes)
            }

            else -> {
                stringResource(R.string.timeout_title)
            }
        }
    MonkiOverlayCard(paneTitle = title, modifier = modifier) {
        Text(text = state.targetLabel, color = colors.ink3, style = typography.label)
        Text(text = title, color = colors.ink1, style = typography.title)
        GateCloseButton(onClose = onLeave, label = stringResource(R.string.timeout_leave))
        MonkiSecondaryButton(
            text = stringResource(R.string.timeout_extend, state.extensionMinutes),
            onClick = onExtend,
            modifier = Modifier.testTag(GateTestTags.EXTEND),
        )
        Text(
            text = stringResource(R.string.timeout_extend_note, state.nextPauseSeconds),
            color = colors.ink3,
            style = typography.caption,
        )
    }
}
