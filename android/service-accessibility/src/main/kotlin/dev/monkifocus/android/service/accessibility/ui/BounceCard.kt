// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.ui

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import dev.monkifocus.android.detectors.GuardedScreen
import dev.monkifocus.android.service.accessibility.action.OverlayContent

/**
 * The card over one of our own Settings screens (plan 04 §2): it says what
 * the screen would undo and always shows the way out, "Disable protection",
 * which starts the 2-minute exit. Never a silent block; "Go back" is the
 * first, focused action.
 */
@Composable
internal fun BounceCard(
    content: OverlayContent.Bounce,
    onBack: () -> Unit,
    onDisable: () -> Unit,
    onKeep: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    val title = stringResource(R.string.bounce_title)
    MonkiOverlayCard(paneTitle = title, modifier = modifier.testTag(OverlayTestTags.BOUNCE)) {
        Text(text = title, color = colors.ink1, style = typography.title)
        Text(text = stringResource(bodyOf(content.screen)), color = colors.ink2, style = typography.body)
        MonkiCloseButton(text = stringResource(R.string.bounce_back), onClick = onBack)
        val remaining = content.exitRemainingSeconds
        if (remaining == null) {
            val disable = if (content.guardianLinked) R.string.bounce_disable_guardian else R.string.bounce_disable_no_guardian
            MonkiSecondaryButton(text = stringResource(disable), onClick = onDisable, modifier = Modifier.testTag(OverlayTestTags.DISABLE))
        } else {
            Text(text = stringResource(R.string.exit_waiting), color = colors.ink2, style = typography.body)
            MonkiCountdown(remainingSeconds = remaining, compact = true)
            MonkiQuietButton(text = stringResource(R.string.exit_keep), onClick = onKeep, muted = true)
        }
    }
}

private fun bodyOf(screen: GuardedScreen): Int =
    when (screen) {
        GuardedScreen.DEVICE_ADMIN -> R.string.bounce_body_device_admin
        GuardedScreen.ACCESSIBILITY_DETAIL -> R.string.bounce_body_accessibility
        GuardedScreen.APP_INFO -> R.string.bounce_body_app_info
        GuardedScreen.UNINSTALL -> R.string.bounce_body_uninstall
    }
