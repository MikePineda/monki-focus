// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.model

/** What the statistics screen shows. */
sealed interface StatsScreenState {
    data object Loading : StatsScreenState

    /** No usage access and nothing recorded: explain and offer the fix. */
    data object NoUsageAccess : StatsScreenState

    /** Usage access is on but nothing was counted yet (the first ingest runs within ~15 minutes). */
    data object NoDataYet : StatsScreenState

    /** Something to show; [usageAccessMissing] adds the explanation and the fix above it. */
    data class Ready(
        val today: TodayStats,
        val week: WeekStats,
        val usageAccessMissing: Boolean,
    ) : StatsScreenState

    /** The local store could not be read. */
    data object Failed : StatsScreenState
}
