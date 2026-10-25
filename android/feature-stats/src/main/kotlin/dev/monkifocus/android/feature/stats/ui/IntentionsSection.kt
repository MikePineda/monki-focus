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
import dev.monkifocus.android.core.ui.theme.MonkiSpacing
import dev.monkifocus.android.feature.stats.model.TodayStats

/** Today's intentions from the gate: started, kept, broken and dropped (counts only, never the typed text). */
@Composable
internal fun IntentionsSection(intentions: TodayStats.IntentionSummary) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    Column(modifier = Modifier.testTag(StatsTestTags.INTENTIONS), verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceXs)) {
        Text(
            text = stringResource(R.string.stats_intentions_title),
            color = colors.ink1,
            style = typography.heading,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text =
                if (intentions.total == 0) {
                    stringResource(R.string.stats_intentions_none)
                } else {
                    stringResource(
                        R.string.stats_intentions_summary,
                        intentions.total,
                        intentions.kept,
                        intentions.broken,
                        intentions.abandoned,
                    )
                },
            color = colors.ink2,
            style = typography.body,
        )
    }
}
