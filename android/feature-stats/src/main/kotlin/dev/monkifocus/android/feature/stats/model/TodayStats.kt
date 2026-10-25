// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.model

import dev.monkifocus.android.core.domain.analytics.ActivitySource

/**
 * Today in the pinned zone, the same summary as the extension's popup
 * (`StatsContract.TodayStats`). Seconds everywhere; levels are indices 0..4
 * (Distracting … Focus), the analytics level divided by 25.
 */
data class TodayStats(
    /** Local date `YYYY-MM-DD`. */
    val date: String,
    /** Focus pulse 0..100, null without tracked time (shown as "—"). */
    val pulse: Int?,
    val totalSeconds: Long,
    /** Categorised seconds per level index 0..4 (always five entries). */
    val secondsByLevel: List<Long>,
    /** Seconds without a category (neutral in the pulse). */
    val uncategorisedSeconds: Long,
    /** At most [TodayStatsQuery.TOP_ACTIVITIES], most seconds first. */
    val topActivities: List<TopActivity>,
    val intentions: IntentionSummary,
) {
    /** An app (by package) or a site (by domain), never a URL, a path or a title. */
    data class TopActivity(
        val activityKey: String,
        val source: ActivitySource,
        val seconds: Long,
        /** The level index the activity spent most of its time at today. */
        val levelIndex: Int,
    )

    /** Today's intentions from the gate: started, kept, broken, dropped without an answer. */
    data class IntentionSummary(
        val total: Int,
        val kept: Int,
        val broken: Int,
        val abandoned: Int,
    ) {
        companion object {
            val NONE = IntentionSummary(0, 0, 0, 0)
        }
    }
}
