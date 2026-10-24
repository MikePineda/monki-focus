// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

/**
 * A weekly `{days, start, end}` window in local wall-clock minutes
 * (SEMANTICS.md §6.1), shared by schedules, `workHours` and bedtime.
 */
interface DailyWindowSpec {
    val days: List<Weekday>

    /** `HH:MM`, 24-hour. */
    val start: String

    /** `HH:MM`, 24-hour; `end <= start` crosses midnight and `end == start` is 24 hours. */
    val end: String
}
