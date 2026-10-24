// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.DailyWindowSpec

private const val MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY

/**
 * Week sets (SEMANTICS.md §6.1): for comparisons a list of schedules is the
 * set of minutes it covers on the 10 080-minute week starting Monday 00:00,
 * windows wrapping from Sunday into Monday. Empty schedules are the whole
 * week. `{mon 00:30–07:00}` is not contained in `{mon 22:30–07:00}`.
 */
internal class WeekSet private constructor(
    private val minutes: BooleanArray,
) {
    /** Every minute of `inner` is in this set. */
    fun contains(inner: WeekSet): Boolean = inner.minutes.indices.all { !inner.minutes[it] || minutes[it] }

    fun intersects(other: WeekSet): Boolean = minutes.indices.any { minutes[it] && other.minutes[it] }

    override fun equals(other: Any?): Boolean = other is WeekSet && minutes.contentEquals(other.minutes)

    override fun hashCode(): Int = minutes.contentHashCode()

    companion object {
        fun of(windows: List<DailyWindowSpec>): WeekSet {
            val set = BooleanArray(MINUTES_PER_WEEK)
            if (windows.isEmpty()) return WeekSet(set.apply { fill(true) })
            for (window in windows) {
                val start = windowStartMinute(window)
                val length = windowLengthMinutes(window)
                for (day in window.days) {
                    val first = day.ordinal * MINUTES_PER_DAY + start
                    for (minute in first until first + length) set[minute % MINUTES_PER_WEEK] = true
                }
            }
            return WeekSet(set)
        }
    }
}
