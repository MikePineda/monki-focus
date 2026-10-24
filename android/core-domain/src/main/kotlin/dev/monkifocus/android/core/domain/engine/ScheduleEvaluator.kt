// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.RuleSchedule
import dev.monkifocus.android.core.domain.rules.Schedule
import dev.monkifocus.android.core.domain.rules.ScheduleRef

/*
 * `isScheduleActive(schedules, workHours, now, timeZone)` (SEMANTICS.md §6.1):
 * a list of schedules is active when the local wall time falls in one of their
 * windows; an empty list is always active. `{ref: "workHours"}` resolves to the
 * rule set's work hours.
 */

/** Replaces every `{ref: "workHours"}` with the work hours themselves. */
internal fun resolveSchedules(
    schedules: List<RuleSchedule>,
    workHours: Schedule,
): List<Schedule> =
    schedules.map { schedule ->
        when (schedule) {
            is ScheduleRef -> workHours
            is Schedule -> schedule
        }
    }

/** Same as [isScheduleActive] for an instant already in epoch seconds. */
internal fun isScheduleActiveAt(
    schedules: List<RuleSchedule>,
    workHours: Schedule,
    epochSeconds: Long,
    timeZone: String,
): Boolean {
    if (schedules.isEmpty()) return true
    val local = localTimeAt(epochSeconds, timeZone)
    return resolveSchedules(schedules, workHours).any { occurrenceAt(it, local) != null }
}

fun isScheduleActive(
    schedules: List<RuleSchedule>,
    workHours: Schedule,
    now: String,
    timeZone: String,
): Boolean = isScheduleActiveAt(schedules, workHours, epochSecondsOf(now), timeZone)
