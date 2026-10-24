// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.DailyWindowSpec

/*
 * A weekly `{days, start, end}` window in local wall-clock minutes
 * (SEMANTICS.md §6.1): for each listed day `d`, `[d + start, d + start + length)`
 * with `length = (end − start) mod 24 h` and `0` meaning 24 hours. A window that
 * crosses midnight belongs to the day it starts on. Used by schedules,
 * `workHours` and bedtime alike.
 */

internal const val MINUTES_PER_DAY = 1440

/** One occurrence of a window: the local day it starts on and its minutes. */
internal data class WindowOccurrence(
    val startDayNumber: Long,
    val startMinute: Int,
    val lengthMinutes: Int,
)

/** Minutes since midnight of a `HH:MM` time of day. */
internal fun minutesOfTimeOfDay(timeOfDay: String): Int = timeOfDay.substring(0, 2).toInt() * 60 + timeOfDay.substring(3, 5).toInt()

internal fun windowStartMinute(spec: DailyWindowSpec): Int = minutesOfTimeOfDay(spec.start)

internal fun windowLengthMinutes(spec: DailyWindowSpec): Int {
    val length = Math.floorMod(minutesOfTimeOfDay(spec.end) - minutesOfTimeOfDay(spec.start), MINUTES_PER_DAY)
    return if (length == 0) MINUTES_PER_DAY else length
}

private fun startsOn(
    spec: DailyWindowSpec,
    weekday: Int,
): Boolean = spec.days.any { it.ordinal == weekday }

/**
 * The occurrence of the window that contains the local time, if any. Windows
 * last at most 24 hours, so only the previous and the current local day can
 * contain it.
 */
internal fun occurrenceAt(
    spec: DailyWindowSpec,
    local: LocalTime,
): WindowOccurrence? {
    val start = windowStartMinute(spec)
    val length = windowLengthMinutes(spec)
    for (daysBack in listOf(1, 0)) {
        val minute = local.minuteOfDay + daysBack * MINUTES_PER_DAY
        val weekday = Math.floorMod(local.weekday - daysBack, 7)
        if (startsOn(spec, weekday) && minute >= start && minute < start + length) {
            return WindowOccurrence(local.dayNumber - daysBack, start, length)
        }
    }
    return null
}

/**
 * Whether the local time falls in `[start − minutesBefore, start)` of a
 * listed day (the bedtime warning, §6.2). The lead may reach into the
 * previous local day.
 */
internal fun isInLeadUp(
    spec: DailyWindowSpec,
    local: LocalTime,
    minutesBefore: Int,
): Boolean {
    val start = windowStartMinute(spec)
    for (daysAhead in listOf(0, 1)) {
        val minute = local.minuteOfDay - daysAhead * MINUTES_PER_DAY
        val weekday = (local.weekday + daysAhead) % 7
        if (startsOn(spec, weekday) && minute >= start - minutesBefore && minute < start) return true
    }
    return false
}
