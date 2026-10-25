// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.theme.MonkiSpacing

/**
 * "Protection active — notice is off" (plan 04 §2, rule 2): shown on the
 * app's home screen and on every gate and bounce screen whenever protection
 * runs without its persistent notice (no notification permission), so it is
 * never active unseen.
 */
@Composable
fun NoticeOffBanner(modifier: Modifier = Modifier) {
    Text(
        text = stringResource(R.string.notice_off_banner),
        color = MonkiTheme.colors.ink1,
        style = MonkiTheme.typography.label,
        modifier =
            modifier
                .fillMaxWidth()
                .background(MonkiTheme.colors.surface1)
                .statusBarsPadding()
                .padding(MonkiSpacing.spaceSm)
                .testTag(OverlayTestTags.NOTICE_OFF),
    )
}
