// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
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
import dev.monkifocus.android.feature.stats.model.WeekStatsQuery

/**
 * The pulse by local hour and weekday over the last weeks: 7 rows × 24
 * cells coloured by the five pulse bands (empty cells had no time), a text
 * legend of the bands, or a table of every hour with tracked time.
 */
@Composable
internal fun HeatmapSection(week: WeekStats) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    var showTable by rememberSaveable { mutableStateOf(false) }
    val title = stringResource(R.string.stats_heatmap_title)
    Column(verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceSm)) {
        Text(text = title, color = colors.ink1, style = typography.heading, modifier = Modifier.semantics { heading() })
        Text(text = stringResource(R.string.stats_heatmap_caption, week.weeks), color = colors.ink2, style = typography.bodySm)
        ChartTableToggle(showTable, { showTable = it }, StatsTestTags.HEATMAP)
        if (showTable) {
            HeatmapTable(week)
        } else {
            Column(
                modifier = Modifier.fillMaxWidth().testTag(StatsTestTags.HEATMAP).semantics { contentDescription = title },
                verticalArrangement = Arrangement.spacedBy(CELL_GAP),
            ) {
                (0 until WeekStatsQuery.WEEK_DAYS).forEach { weekday ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(CELL_GAP)) {
                        Text(
                            text = weekdayName(weekday),
                            color = colors.ink2,
                            style = typography.caption,
                            modifier = Modifier.width(LABEL_WIDTH),
                        )
                        week.hourly
                            .filter { it.weekday == weekday }
                            .sortedBy { it.hour }
                            .forEach { cell ->
                                val band = cell.band
                                Box(
                                    modifier =
                                        Modifier
                                            .weight(1f)
                                            .aspectRatio(1f)
                                            .background(if (band == null) colors.surface2 else levelColor(band)),
                                )
                            }
                    }
                }
            }
            (0 until PulseBand.COUNT).forEach { band ->
                val range = PulseBand.rangeOf(band)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceSm)) {
                    Box(modifier = Modifier.size(MonkiSpacing.spaceSm).background(levelColor(band)))
                    Text(
                        text = stringResource(R.string.stats_heatmap_band, levelName(band), range.first, range.last),
                        color = colors.ink2,
                        style = typography.bodySm,
                    )
                }
            }
        }
    }
}

@Composable
private fun HeatmapTable(week: WeekStats) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    val tracked = week.hourly.filter { it.averageSeconds > 0 }
    Column(modifier = Modifier.fillMaxWidth().testTag(StatsTestTags.HEATMAP_TABLE)) {
        if (tracked.isEmpty()) {
            Text(text = stringResource(R.string.stats_heatmap_table_empty), color = colors.ink2, style = typography.body)
        } else {
            TableRow(
                first = stringResource(R.string.stats_heatmap_hour),
                second = stringResource(R.string.stats_week_tracked),
                third = stringResource(R.string.stats_week_pulse),
                header = true,
            )
            val none = stringResource(R.string.stats_pulse_none)
            tracked.forEach { cell ->
                TableRow(
                    first = stringResource(R.string.stats_heatmap_cell, weekdayName(cell.weekday), cell.hour),
                    second = durationText(cell.averageSeconds),
                    third = cell.pulse?.toString() ?: none,
                )
            }
        }
    }
}

private val CELL_GAP = MonkiSpacing.spaceXs / 4
private val LABEL_WIDTH = MonkiSpacing.spaceXl
