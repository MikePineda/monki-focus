// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.Serializable

/** `schedule.schema.json`: a weekly window in the pinned zone's wall-clock time. */
@Serializable
data class Schedule(
    override val days: List<Weekday>,
    override val start: String,
    override val end: String,
) : RuleSchedule,
    DailyWindowSpec
