// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.repository

import dev.monkifocus.android.core.domain.rules.Bedtime
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.Schedule
import dev.monkifocus.android.core.domain.rules.Weekday

/** A minimal valid rule set; tests tell revisions apart by [revision] and [bedtimeEnabled]. */
fun aRuleset(
    revision: Int,
    bedtimeEnabled: Boolean = false,
): Ruleset =
    Ruleset(
        schemaVersion = 1,
        revision = revision,
        updatedAt = "2026-10-25T09:00:00Z",
        timeZone = "Etc/UTC",
        rules = emptyList(),
        categories = emptyList(),
        bedtime = Bedtime(enabled = bedtimeEnabled, days = Weekday.entries, start = "23:00", end = "07:00", warnMinutesBefore = 15),
        workHours =
            Schedule(
                days = listOf(Weekday.MON, Weekday.TUE, Weekday.WED, Weekday.THU, Weekday.FRI),
                start = "09:00",
                end = "17:00",
            ),
    )
