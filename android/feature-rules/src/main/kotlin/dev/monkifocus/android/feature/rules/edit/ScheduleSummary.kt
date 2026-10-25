// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.edit

/** When a rule applies, as the list shows it. */
sealed interface ScheduleSummary {
    data object Always : ScheduleSummary

    data object WorkHours : ScheduleSummary

    /** [windows] own windows, plus the work hours when [withWorkHours]. */
    data class Windows(
        val windows: Int,
        val withWorkHours: Boolean,
    ) : ScheduleSummary
}
