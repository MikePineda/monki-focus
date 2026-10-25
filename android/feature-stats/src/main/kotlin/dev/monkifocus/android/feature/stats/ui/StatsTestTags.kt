// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.ui

/** Test tags of the statistics screens. */
object StatsTestTags {
    const val SCREEN = "stats_screen"
    const val ENTRY = "stats_entry"
    const val BACK = "stats_back"
    const val PULSE = "stats_pulse"
    const val LEVEL_BAR = "stats_level_bar"
    const val LEVEL_TABLE = "stats_level_table"
    const val TOP = "stats_top"
    const val INTENTIONS = "stats_intentions"
    const val WEEK_BARS = "stats_week_bars"
    const val WEEK_TABLE = "stats_week_table"
    const val HEATMAP = "stats_heatmap"
    const val HEATMAP_TABLE = "stats_heatmap_table"
    const val NO_ACCESS = "stats_no_access"
    const val FIX_ACCESS = "stats_fix_access"
    const val EMPTY = "stats_empty"
    const val FAILED = "stats_failed"
    const val RETRY = "stats_retry"

    fun toggle(section: String): String = "${section}_toggle"
}
