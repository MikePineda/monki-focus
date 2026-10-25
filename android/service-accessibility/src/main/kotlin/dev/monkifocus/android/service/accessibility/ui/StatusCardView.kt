// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.components.MonkiQuietButton
import dev.monkifocus.android.core.ui.components.MonkiSecondaryButton
import dev.monkifocus.android.core.ui.theme.MonkiRadius
import dev.monkifocus.android.core.ui.theme.MonkiSpacing
import dev.monkifocus.android.service.accessibility.action.StatusCard

/**
 * A protection status card at the top of the screen that blocks nothing:
 * "Finish setting up monki-focus" while protection is not armed in our app
 * (nothing is enforced), or, once per session, what protection without
 * notifications means, with a button to allow them.
 */
@Composable
internal fun StatusCardView(
    card: StatusCard,
    onPrimary: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    val shape = RoundedCornerShape(MonkiRadius.radiusLg)
    val (title, body, primary) =
        when (card) {
            StatusCard.SETUP -> Triple(R.string.setup_card_title, R.string.setup_card_body, R.string.setup_card_open)
            StatusCard.NOTICE_OFF -> Triple(R.string.notice_card_title, R.string.notice_card_body, R.string.notice_card_allow)
        }
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(MonkiSpacing.spaceSm)
                .background(colors.surface1, shape)
                .border(1.dp, colors.line, shape)
                .padding(MonkiSpacing.spaceMd)
                .testTag(OverlayTestTags.STATUS_CARD),
        verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceSm),
    ) {
        Text(text = stringResource(title), color = colors.ink1, style = typography.title)
        Text(text = stringResource(body), color = colors.ink2, style = typography.body)
        Row(horizontalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceSm)) {
            MonkiSecondaryButton(text = stringResource(primary), onClick = onPrimary)
            MonkiQuietButton(text = stringResource(R.string.card_dismiss), onClick = onDismiss, muted = true)
        }
    }
}
