// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.components.MonkiQuietButton
import dev.monkifocus.android.core.ui.theme.MonkiSpacing

/**
 * The hide-feed cover (plan §2.3): a plain `surface-0` band over the feed
 * between the bars the pack keeps visible, with one line and Close (BACK).
 * Nothing of the feed shows through.
 */
@Composable
internal fun FeedCover(
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MonkiTheme.colors
    Box(
        modifier =
            modifier
                .fillMaxSize()
                .background(colors.surface0)
                .padding(MonkiSpacing.spaceLg)
                .testTag(OverlayTestTags.COVER),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceMd)) {
            Text(
                text = stringResource(R.string.cover_feed_hidden),
                color = colors.ink2,
                style = MonkiTheme.typography.body,
                textAlign = TextAlign.Center,
            )
            MonkiQuietButton(text = stringResource(R.string.action_close), onClick = onClose)
        }
    }
}
