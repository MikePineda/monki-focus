// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.model

import dev.monkifocus.android.feature.stats.model.StatsTestData.ZONE
import dev.monkifocus.android.feature.stats.model.StatsTestData.at
import dev.monkifocus.android.feature.stats.model.StatsTestData.block
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WeekStatsQueryTest {
    private val now = at("2026-10-25T20:00:00Z")

    @Test
    fun the_week_lists_the_last_seven_local_days_oldest_first() {
        val week = WeekStatsQuery.compute(emptyList(), now, ZONE)

        assertEquals((19..25).map { "2026-10-$it" }, week.days.map { it.date })
        assertEquals(listOf(0, 1, 2, 3, 4, 5, 6), week.days.map { it.weekday })
        assertTrue(week.empty)
        assertTrue(week.days.all { it.pulse == null })
    }

    @Test
    fun each_day_has_its_own_pulse_and_total() {
        val blocks = listOf(block("2026-10-23T09:00:00Z", "a.example", 100), block("2026-10-25T09:00:00Z", "b.example", 0))

        val week = WeekStatsQuery.compute(blocks, now, ZONE)

        assertEquals(listOf(null, null, null, null, 100, null, 0), week.days.map { it.pulse })
        assertEquals(300L, week.days.last().totalSeconds)
    }

    @Test
    fun the_heatmap_averages_each_weekday_hour_over_four_weeks() {
        // Sunday 10:00 local (08:00 UTC, before the change UTC+2; after it UTC+1 so 09:00 UTC).
        val blocks =
            listOf(
                block("2026-10-25T09:00:00Z", "a.example", 100),
                block("2026-10-18T08:00:00Z", "a.example", 0),
            )

        val week = WeekStatsQuery.compute(blocks, now, ZONE)

        assertEquals(7 * 24, week.hourly.size)
        val sundayTen = week.hourly.single { it.weekday == 6 && it.hour == 10 }
        assertEquals(150L, sundayTen.averageSeconds)
        assertEquals(50, sundayTen.pulse)
        assertEquals(2, sundayTen.band)
        assertNull(week.hourly.single { it.weekday == 0 && it.hour == 0 }.band)
    }

    @Test
    fun pulse_bands_are_five_fifths_of_the_scale() {
        assertEquals(listOf(0, 0, 1, 2, 3, 4, 4), listOf(0, 19, 20, 59, 60, 80, 100).map { PulseBand.of(it) })
        assertNull(PulseBand.of(null))
        assertEquals(80..100, PulseBand.rangeOf(4))
        assertEquals(20..39, PulseBand.rangeOf(1))
    }
}
