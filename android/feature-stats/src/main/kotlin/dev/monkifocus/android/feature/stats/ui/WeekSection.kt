// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.theme.MonkiSpacing
import dev.monkifocus.android.feature.stats.model.PulseBand
import dev.monkifocus.android.feature.stats.model.WeekStats

/**
 * The pulse of each of the last seven days as bars (height = pulse, colour =
 * its band, the number above, the weekday below), or the same as a table.
 */
@Composable
internal fun WeekSection(week: WeekStats) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    var showTable by rememberSaveable { mutableStateOf(false) }
    val none = stringResource(R.string.stats_pulse_none)
    Column(verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceSm)) {
        Text(
            text = stringResource(R.string.stats_week_title),
            color = colors.ink1,
            style = typography.heading,
            modifier = Modifier.semantics { heading() },
        )
        ChartTableToggle(showTable, { showTable = it }, StatsTestTags.WEEK_BARS)
        if (showTable) {
            Column(modifier = Modifier.fillMaxWidth().testTag(StatsTestTags.WEEK_TABLE)) {
                TableRow(
                    first = stringResource(R.string.stats_week_day),
                    second = stringResource(R.string.stats_week_tracked),
                    third = stringResource(R.string.stats_week_pulse),
                    header = true,
                )
                week.days.forEach { day ->
                    TableRow(
                        first = "${weekdayName(day.weekday)} ${day.date}",
                        second = durationText(day.totalSeconds),
                        third = day.pulse?.toString() ?: none,
                    )
                }
            }
        } else {
            val summary = week.days.map { stringResource(R.string.stats_week_item, weekdayName(it.weekday), it.pulse?.toString() ?: none) }
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .testTag(StatsTestTags.WEEK_BARS)
                        .semantics { contentDescription = summary.joinToString(", ") },
                horizontalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceXs),
                verticalAlignment = Alignment.Bottom,
            ) {
                week.days.forEach { day ->
                    Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = day.pulse?.toString() ?: none, color = colors.ink2, style = typography.numeric)
                        Box(modifier = Modifier.fillMaxWidth().height(CHART_HEIGHT), contentAlignment = Alignment.BottomCenter) {
                            val pulse = day.pulse
                            if (pulse != null) {
                                Box(
                                    modifier =
                                        Modifier
                                            .fillMaxWidth()
                                            .height(CHART_HEIGHT * (pulse.coerceAtLeast(MIN_VISIBLE_PULSE) / FULL_PULSE))
                                            .background(levelColor(PulseBand.of(pulse) ?: 0)),
                                )
                            }
                        }
                        Box(modifier = Modifier.fillMaxWidth().height(HAIRLINE).background(colors.baseline))
                        Text(text = weekdayName(day.weekday), color = colors.ink2, style = typography.caption)
                    }
                }
            }
        }
    }
}

private val CHART_HEIGHT = MonkiSpacing.space3xl * 2
private val HAIRLINE = MonkiSpacing.spaceXs / 4
private const val FULL_PULSE = 100f

/** A pulse of 0 still shows a sliver, so "tracked, all distracting" differs from "nothing tracked". */
private const val MIN_VISIBLE_PULSE = 2
