// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.model

import dev.monkifocus.android.core.domain.analytics.ActivitySource
import dev.monkifocus.android.core.domain.ports.IntentionOutcome
import dev.monkifocus.android.feature.stats.model.StatsTestData.ZONE
import dev.monkifocus.android.feature.stats.model.StatsTestData.at
import dev.monkifocus.android.feature.stats.model.StatsTestData.block
import dev.monkifocus.android.feature.stats.model.StatsTestData.intention
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TodayStatsQueryTest {
    private val now = at("2026-10-25T20:00:00Z")

    @Test
    fun nothing_tracked_has_no_pulse() {
        val today = TodayStatsQuery.compute(emptyList(), emptyList(), now, ZONE)

        assertNull(today.pulse)
        assertEquals(0L, today.totalSeconds)
        assertEquals(listOf(0L, 0L, 0L, 0L, 0L), today.secondsByLevel)
    }

    @Test
    fun the_pulse_weights_time_by_level() {
        val blocks = listOf(block("2026-10-25T09:00:00Z", "com.example.notes", 100), block("2026-10-25T09:05:00Z", "com.example.social", 0))

        val today = TodayStatsQuery.compute(blocks, emptyList(), now, ZONE)

        assertEquals(50, today.pulse)
        assertEquals(600L, today.totalSeconds)
        assertEquals(listOf(300L, 0L, 0L, 0L, 300L), today.secondsByLevel)
    }

    @Test
    fun only_todays_local_date_counts() {
        // 22:55 UTC on the 24th is 00:55 on the 25th in Berlin (UTC+2 before the DST change); 21:55 is still the 24th.
        val blocks = listOf(block("2026-10-24T22:55:00Z", "com.example.notes", 100), block("2026-10-24T21:55:00Z", "com.example.social", 0))

        val today = TodayStatsQuery.compute(blocks, emptyList(), now, ZONE)

        assertEquals("2026-10-25", today.date)
        assertEquals(300L, today.totalSeconds)
        assertEquals(100, today.pulse)
    }

    @Test
    fun uncategorised_time_is_reported_apart_and_counts_as_neutral() {
        val blocks = listOf(block("2026-10-25T09:00:00Z", "com.example.unknown", 50, category = "uncategorised"))

        val today = TodayStatsQuery.compute(blocks, emptyList(), now, ZONE)

        assertEquals(300L, today.uncategorisedSeconds)
        assertEquals(listOf(0L, 0L, 0L, 0L, 0L), today.secondsByLevel)
        assertEquals(50, today.pulse)
    }

    @Test
    fun top_activities_are_sorted_by_time_capped_and_keep_their_main_level_and_source() {
        val blocks =
            (0 until 12).map { i -> block("2026-10-25T10:${"%02d".format(i * 5 % 60)}:00Z", "app$i.example", 50, seconds = 10 + i) } +
                listOf(
                    block("2026-10-25T12:00:00Z", "video.example", 0, source = ActivitySource.WEB),
                    block("2026-10-25T12:05:00Z", "video.example", 50, seconds = 100, source = ActivitySource.WEB),
                )

        val top = TodayStatsQuery.compute(blocks, emptyList(), now, ZONE).topActivities

        assertEquals(TodayStatsQuery.TOP_ACTIVITIES, top.size)
        assertEquals(TodayStats.TopActivity("video.example", ActivitySource.WEB, 400, 0), top.first())
        assertEquals(top.sortedByDescending { it.seconds }, top)
    }

    @Test
    fun blocks_without_a_key_count_in_totals_but_not_in_the_top() {
        val today = TodayStatsQuery.compute(listOf(block("2026-10-25T09:00:00Z", null, 75)), emptyList(), now, ZONE)

        assertEquals(300L, today.totalSeconds)
        assertEquals(emptyList<TodayStats.TopActivity>(), today.topActivities)
    }

    @Test
    fun todays_intentions_are_summarised_by_outcome() {
        val intentions =
            listOf(
                intention("2026-10-25T09:00:00Z", IntentionOutcome.KEPT),
                intention("2026-10-25T10:00:00Z", IntentionOutcome.BROKEN),
                intention("2026-10-25T11:00:00Z", IntentionOutcome.ABANDONED),
                intention("2026-10-25T12:00:00Z", null),
                intention("2026-10-24T09:00:00Z", IntentionOutcome.KEPT),
            )

        val summary = TodayStatsQuery.compute(emptyList(), intentions, now, ZONE).intentions

        assertEquals(TodayStats.IntentionSummary(total = 4, kept = 1, broken = 1, abandoned = 1), summary)
    }
}
