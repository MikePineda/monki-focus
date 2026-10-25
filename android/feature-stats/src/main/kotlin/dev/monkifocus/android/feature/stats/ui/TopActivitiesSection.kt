// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
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

/** Today's top apps and sites: name, level and time, most time first. */
@Composable
internal fun TopActivitiesSection(today: TodayStats) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    Column(
        modifier = Modifier.fillMaxWidth().testTag(StatsTestTags.TOP),
        verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceXs),
    ) {
        Text(
            text = stringResource(R.string.stats_top_title),
            color = colors.ink1,
            style = typography.heading,
            modifier = Modifier.semantics { heading() },
        )
        if (today.topActivities.isEmpty()) {
            Text(text = stringResource(R.string.stats_top_empty), color = colors.ink2, style = typography.body)
        } else {
            today.topActivities.forEach { activity ->
                TableRow(first = activityLabel(activity), second = durationText(activity.seconds), third = levelName(activity.levelIndex))
            }
        }
    }
}
