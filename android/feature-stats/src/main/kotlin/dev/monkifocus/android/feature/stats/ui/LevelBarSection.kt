// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.theme.MonkiRadius
import dev.monkifocus.android.core.ui.theme.MonkiSpacing
import dev.monkifocus.android.feature.stats.model.TodayStats
import dev.monkifocus.android.feature.stats.model.TodayStatsQuery

/** One part of today's time: its name, colour and seconds. */
private data class LevelPart(
    val name: String,
    val color: Color,
    val seconds: Long,
)

/**
 * Today by level: a 5-level stacked bar (plus uncategorised time) with a text
 * legend that carries every number, or the same numbers as a table.
 */
@Composable
internal fun LevelBarSection(today: TodayStats) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    var showTable by rememberSaveable { mutableStateOf(false) }
    val parts =
        (
            (0 until TodayStatsQuery.LEVEL_COUNT).map { index ->
                LevelPart(levelName(index), levelColor(index), today.secondsByLevel[index])
            }
        ) +
            LevelPart(stringResource(R.string.stats_level_uncategorised), colors.markNeutral, today.uncategorisedSeconds)
    val shown = parts.filter { it.seconds > 0 }

    Column(verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceSm)) {
        Text(
            text = stringResource(R.string.stats_levels_title),
            color = colors.ink1,
            style = typography.heading,
            modifier = Modifier.semantics { heading() },
        )
        ChartTableToggle(showTable, { showTable = it }, StatsTestTags.LEVEL_BAR)
        if (showTable) {
            Column(modifier = Modifier.fillMaxWidth().testTag(StatsTestTags.LEVEL_TABLE)) {
                TableRow(stringResource(R.string.stats_table_level), stringResource(R.string.stats_table_time), header = true)
                parts.forEach { part -> TableRow(part.name, durationText(part.seconds)) }
            }
        } else {
            val legend = shown.map { stringResource(R.string.stats_level_item, it.name, durationText(it.seconds)) }
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(MonkiSpacing.spaceMd)
                        .clip(RoundedCornerShape(MonkiRadius.radiusSm))
                        .background(colors.surface2)
                        .testTag(StatsTestTags.LEVEL_BAR)
                        .semantics { contentDescription = legend.joinToString(", ") },
            ) {
                shown.forEach { part ->
                    Box(modifier = Modifier.weight(part.seconds.toFloat()).fillMaxHeight().background(part.color))
                }
            }
            shown.forEachIndexed { index, part ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceSm)) {
                    Box(modifier = Modifier.size(MonkiSpacing.spaceSm).background(part.color))
                    Text(text = legend[index], color = colors.ink2, style = typography.bodySm)
                }
            }
        }
    }
}
