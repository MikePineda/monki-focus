// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** `schedule.schema.json#/$defs/scheduleRef`: a named schedule of the rule set (today only `workHours`). */
@Serializable
data class ScheduleRef(
    val ref: ScheduleName,
) : RuleSchedule {
    @Serializable
    enum class ScheduleName {
        @SerialName("workHours")
        WORK_HOURS,
    }

    companion object {
        val WORK_HOURS = ScheduleRef(ScheduleName.WORK_HOURS)
    }
}
