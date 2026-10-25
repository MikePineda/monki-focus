// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.feature.gate.GateActions
import dev.monkifocus.android.feature.gate.GateScreen
import dev.monkifocus.android.service.accessibility.action.OverlayContent
import dev.monkifocus.android.service.accessibility.pipeline.UserAction

/**
 * Renders one [OverlayContent] (in the overlay window or `GateActivity`)
 * and reports every tap as a [UserAction]: the `:feature-gate` screens for
 * gates, the cover and the bounce card. While protection runs without its
 * notice ([noticeOff]) every gate and bounce screen carries the banner.
 */
@Composable
fun OverlayScreen(
    content: OverlayContent,
    noticeOff: Boolean,
    onAction: (UserAction) -> Unit,
    modifier: Modifier = Modifier,
) {
    MonkiTheme {
        if (noticeOff && content !is OverlayContent.Cover) {
            Column(modifier = Modifier.fillMaxSize()) {
                NoticeOffBanner()
                Box(modifier = Modifier.weight(1f)) { ScreenOf(content, onAction, modifier) }
            }
        } else {
            ScreenOf(content, onAction, modifier)
        }
    }
}

@Composable
private fun ScreenOf(
    content: OverlayContent,
    onAction: (UserAction) -> Unit,
    modifier: Modifier,
) {
    when (content) {
        is OverlayContent.Gate -> {
            GateScreen(
                state = content.state,
                actions =
                    GateActions(
                        onClose = { onAction(UserAction.Close) },
                        onContinue = { intention, minutes -> onAction(UserAction.Continue(intention, minutes)) },
                        onEmergency = { onAction(UserAction.Emergency) },
                        onCancelEmergency = { onAction(UserAction.CancelEmergency) },
                        onExtend = { onAction(UserAction.Extend) },
                    ),
                modifier = modifier,
            )
        }

        is OverlayContent.Cover -> {
            FeedCover(onClose = { onAction(UserAction.CoverClose) }, modifier = modifier)
        }

        is OverlayContent.Bounce -> {
            BounceCard(
                content = content,
                onBack = { onAction(UserAction.BounceBack) },
                onDisable = { onAction(UserAction.DisableProtection) },
                onKeep = { onAction(UserAction.KeepProtection) },
                modifier = modifier,
            )
        }
    }
}
