// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.ui

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.components.MonkiCloseButton
import dev.monkifocus.android.core.ui.components.MonkiCountdown
import dev.monkifocus.android.core.ui.components.MonkiOverlayCard
import dev.monkifocus.android.core.ui.components.MonkiQuietButton
import dev.monkifocus.android.core.ui.components.MonkiSecondaryButton
import dev.monkifocus.android.service.accessibility.exit.ExitFlowController
import dev.monkifocus.android.service.accessibility.exit.ExitFlowState
import kotlinx.coroutines.delay

/**
 * "Exit and unlink" in the app (plan 04 §2, rule 5): what leaving does, the
 * 2-minute wait with its countdown, and the end. Reachable from the home
 * screen, the notice and every bounce card; nothing here asks the decision
 * engine, so nothing can block it. While it is open it ticks the flow
 * itself, so the exit finishes even when the accessibility service is off.
 */
@Composable
fun ExitAndUnlinkScreen(
    exitFlow: ExitFlowController,
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
    clock: () -> Long = System::currentTimeMillis,
) {
    var state by remember { mutableStateOf(exitFlow.state) }
    var remaining by remember { mutableStateOf(exitFlow.remainingSeconds(clock())) }
    LaunchedEffect(exitFlow) {
        while (true) {
            exitFlow.tick(clock())
            state = exitFlow.state
            remaining = exitFlow.remainingSeconds(clock())
            delay(TICK_MS)
        }
    }
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    val title = stringResource(R.string.exit_title)
    MonkiOverlayCard(paneTitle = title, modifier = modifier.testTag(OverlayTestTags.EXIT)) {
        Text(text = title, color = colors.ink1, style = typography.title)
        when (val current = state) {
            ExitFlowState.Armed -> {
                Text(text = stringResource(R.string.exit_body), color = colors.ink2, style = typography.body)
                MonkiSecondaryButton(
                    text = stringResource(R.string.exit_start),
                    onClick = {
                        state = exitFlow.request(clock())
                        remaining = exitFlow.remainingSeconds(clock())
                    },
                    modifier = Modifier.testTag(OverlayTestTags.EXIT_START),
                )
                MonkiCloseButton(text = stringResource(R.string.exit_keep), onClick = onDone)
            }

            is ExitFlowState.Waiting -> {
                Text(text = stringResource(R.string.exit_waiting), color = colors.ink2, style = typography.body)
                MonkiCountdown(remainingSeconds = remaining ?: 0)
                MonkiQuietButton(
                    text = stringResource(R.string.exit_keep),
                    onClick = {
                        state = exitFlow.cancel(clock())
                        onDone()
                    },
                    muted = true,
                )
            }

            is ExitFlowState.Ended -> {
                Text(text = stringResource(R.string.exit_ended), color = colors.ink2, style = typography.body)
                MonkiCloseButton(text = stringResource(R.string.action_close), onClick = onDone)
            }
        }
    }
}

private const val TICK_MS = 1_000L
