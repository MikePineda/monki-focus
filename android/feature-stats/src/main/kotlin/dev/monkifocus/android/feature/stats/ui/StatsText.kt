// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.feature.stats.model.DurationParts

/*
 * The catalog keys and token colours the statistics sections share: level
 * names and colours (index 0..4, Distracting … Focus), weekday names
 * (Monday = 0) and durations. Copy only from core-ui's string catalog.
 */

private val LEVEL_NAMES =
    listOf(R.string.stats_level_0, R.string.stats_level_1, R.string.stats_level_2, R.string.stats_level_3, R.string.stats_level_4)

private val WEEKDAY_NAMES =
    listOf(
        R.string.stats_weekday_0,
        R.string.stats_weekday_1,
        R.string.stats_weekday_2,
        R.string.stats_weekday_3,
        R.string.stats_weekday_4,
        R.string.stats_weekday_5,
        R.string.stats_weekday_6,
    )

@Composable
internal fun levelName(index: Int): String = stringResource(LEVEL_NAMES[index.coerceIn(0, LEVEL_NAMES.lastIndex)])

@Composable
internal fun weekdayName(weekday: Int): String = stringResource(WEEKDAY_NAMES[weekday.coerceIn(0, WEEKDAY_NAMES.lastIndex)])

@Composable
internal fun levelColor(index: Int): Color {
    val colors = MonkiTheme.colors
    return when (index) {
        0 -> colors.level0
        1 -> colors.level1
        2 -> colors.level2
        3 -> colors.level3
        else -> colors.level4
    }
}

@Composable
internal fun durationText(seconds: Long): String {
    val parts = DurationParts.of(seconds)
    return if (parts.hours > 0) {
        stringResource(R.string.stats_duration_hours, parts.hours.toInt(), parts.minutes.toInt())
    } else {
        stringResource(R.string.stats_duration_minutes, parts.minutes.toInt())
    }
}
