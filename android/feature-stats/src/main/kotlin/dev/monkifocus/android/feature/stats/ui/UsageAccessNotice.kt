// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.components.MonkiSecondaryButton
import dev.monkifocus.android.core.ui.theme.MonkiSpacing

/**
 * Why statistics need usage access and the way to turn it on ([onFix] goes
 * through the onboarding rules, like Status's fix buttons). [compact] is the
 * one-line banner above data recorded before access was revoked.
 */
@Composable
internal fun UsageAccessNotice(
    compact: Boolean,
    onFix: () -> Unit,
) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    Column(modifier = Modifier.testTag(StatsTestTags.NO_ACCESS), verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceSm)) {
        if (compact) {
            Text(text = stringResource(R.string.stats_no_access_banner), color = colors.statusWarning, style = typography.bodyStrong)
        } else {
            Text(
                text = stringResource(R.string.stats_no_access_title),
                color = colors.ink1,
                style = typography.heading,
                modifier = Modifier.semantics { heading() },
            )
            Text(text = stringResource(R.string.stats_no_access_body), color = colors.ink2, style = typography.body)
        }
        MonkiSecondaryButton(
            text = stringResource(R.string.stats_no_access_fix),
            onClick = onFix,
            modifier = Modifier.testTag(StatsTestTags.FIX_ACCESS),
        )
    }
}
