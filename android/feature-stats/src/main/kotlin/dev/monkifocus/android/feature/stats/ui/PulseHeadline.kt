// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.theme.MonkiSpacing
import dev.monkifocus.android.feature.stats.model.TodayStats

/** Today's focus pulse as one big number ("—" without tracked time) and the tracked time. */
@Composable
internal fun PulseHeadline(today: TodayStats) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    val label = stringResource(R.string.stats_pulse_label)
    val value = today.pulse?.toString() ?: stringResource(R.string.stats_pulse_none)
    val context =
        if (today.pulse == null) {
            stringResource(R.string.stats_pulse_context_empty)
        } else {
            stringResource(R.string.stats_pulse_context, durationText(today.totalSeconds))
        }
    Column(
        modifier =
            Modifier.testTag(StatsTestTags.PULSE).semantics(mergeDescendants = true) {
                contentDescription =
                    "$label: $value, $context"
            },
        verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceXs),
    ) {
        Text(text = label, color = colors.ink2, style = typography.label)
        Text(text = value, color = colors.ink1, style = typography.stat)
        Text(text = context, color = colors.ink2, style = typography.bodySm)
    }
}
