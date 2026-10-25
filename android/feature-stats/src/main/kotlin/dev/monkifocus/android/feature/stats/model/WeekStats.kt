// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.model

/** The last seven local days and the weekday × hour pulse (`StatsContract.WeekStats`). */
data class WeekStats(
    /** Oldest first, today last. */
    val days: List<DailyPulse>,
    /** Weeks the hourly averages cover. */
    val weeks: Int,
    /** 7 × 24 cells, weekday-major (Monday = 0), hour-minor. */
    val hourly: List<HourlyCell>,
) {
    data class DailyPulse(
        val date: String,
        /** Monday = 0 … Sunday = 6. */
        val weekday: Int,
        val pulse: Int?,
        val totalSeconds: Long,
    )

    data class HourlyCell(
        val weekday: Int,
        val hour: Int,
        /** Tracked seconds in that weekday-hour, averaged over [weeks]. */
        val averageSeconds: Long,
        val pulse: Int?,
    ) {
        /** The heatmap band 0..4 of [pulse], null without time. */
        val band: Int? get() = PulseBand.of(pulse)
    }

    /** Nothing tracked in the last seven days. */
    val empty: Boolean get() = days.all { it.totalSeconds == 0L }
}
