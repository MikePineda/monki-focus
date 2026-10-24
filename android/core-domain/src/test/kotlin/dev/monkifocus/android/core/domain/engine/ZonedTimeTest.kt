// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime
import java.time.ZoneOffset

/**
 * `java.time` in the pinned zone behaves like the TypeScript engine's `Intl`
 * at DST gaps and overlaps (same expectations as `ZonedTime.test.ts`).
 */
class ZonedTimeTest {
    private fun wallOf(
        year: Int,
        month: Int,
        day: Int,
        hour: Int,
        minute: Int,
    ): Long = LocalDateTime.of(year, month, day, hour, minute).toEpochSecond(ZoneOffset.UTC)

    @Test
    fun reads_the_local_wall_clock_of_the_pinned_zone() {
        assertEquals(
            LocalTime(dayNumber = 20752, weekday = 0, minuteOfDay = 23 * 60, localDate = "2026-10-26"),
            localTimeAt(epochSecondsOf("2026-10-26T12:00:00Z"), "Australia/Sydney"),
        )
    }

    @Test
    fun numbers_weekdays_from_monday_also_before_the_epoch() {
        assertEquals(3, weekdayOfDay(0))
        assertEquals(2, weekdayOfDay(-1))
    }

    @Test
    fun a_wall_time_inside_the_spring_forward_gap_resolves_to_the_first_instant_after_it() {
        val resolved = firstInstantReachingWall(epochSecondsOf("2026-10-03T12:00:00Z"), wallOf(2026, 10, 4, 2, 30), "Australia/Sydney")

        assertEquals("2026-10-03T16:00:00Z", utcInstantOf(resolved))
    }

    @Test
    fun a_repeated_fall_back_wall_time_resolves_to_its_next_occurrence() {
        val wall = wallOf(2026, 4, 5, 2, 30)
        val first = firstInstantReachingWall(epochSecondsOf("2026-04-04T12:00:00Z"), wall, "Australia/Sydney")
        val second = firstInstantReachingWall(epochSecondsOf("2026-04-04T15:45:00Z"), wall, "Australia/Sydney")

        assertEquals("2026-04-04T15:30:00Z", utcInstantOf(first))
        assertEquals("2026-04-04T16:30:00Z", utcInstantOf(second))
    }

    @Test
    fun a_midnight_skipped_by_dst_resolves_to_the_first_existing_minute_of_the_day() {
        val midnight = nextLocalMidnight(epochSecondsOf("2026-09-05T12:00:00Z"), "America/Santiago")

        assertEquals("2026-09-06T04:00:00Z", utcInstantOf(midnight))
        assertEquals("2026-09-06", localTimeAt(midnight, "America/Santiago").localDate)
        assertEquals(60, localTimeAt(midnight, "America/Santiago").minuteOfDay)
    }

    @Test
    fun the_next_local_midnight_at_midnight_is_the_following_one() {
        assertEquals("2026-10-28T00:00:00Z", utcInstantOf(nextLocalMidnight(epochSecondsOf("2026-10-27T00:00:00Z"), "UTC")))
    }

    @Test
    fun the_hour_skipped_in_spring_and_repeated_in_autumn_reads_like_intl() {
        // Sydney 2026-10-04 02:00 AEST jumps to 03:00 AEDT; 2026-04-05 03:00 AEDT falls back to 02:00 AEST.
        assertEquals(3 * 60, localTimeAt(epochSecondsOf("2026-10-03T16:00:00Z"), "Australia/Sydney").minuteOfDay)
        assertEquals(2 * 60 + 30, localTimeAt(epochSecondsOf("2026-04-04T15:30:00Z"), "Australia/Sydney").minuteOfDay)
        assertEquals(2 * 60 + 30, localTimeAt(epochSecondsOf("2026-04-04T16:30:00Z"), "Australia/Sydney").minuteOfDay)
    }

    @Test
    fun offset_transitions_are_the_first_second_with_the_new_offset() {
        val sydney = "Australia/Sydney"
        val springForward = epochSecondsOf("2026-10-03T16:00:00Z")
        val week = 7 * SECONDS_PER_DAY

        assertEquals(listOf(springForward), offsetTransitionsBetween(springForward - week, springForward + week, sydney))
        assertEquals(listOf(springForward), offsetTransitionsBetween(springForward - 1, springForward, sydney))
        assertEquals(emptyList<Long>(), offsetTransitionsBetween(springForward, springForward + week, sydney))
        assertEquals(
            listOf(epochSecondsOf("2026-10-25T01:00:00Z")),
            offsetTransitionsBetween(epochSecondsOf("2026-10-24T00:00:00Z"), epochSecondsOf("2026-10-26T00:00:00Z"), "Europe/London"),
        )
        assertEquals(emptyList<Long>(), offsetTransitionsBetween(springForward - week, springForward + week, "UTC"))
    }

    @Test
    fun zone_names_resolve_case_sensitively_for_validators() {
        assertTrue(isResolvableTimeZone("Australia/Sydney"))
        assertTrue(isResolvableTimeZone("Asia/Calcutta"))
        assertTrue(isResolvableTimeZone("UTC"))
        assertFalse(isResolvableTimeZone("australia/sydney"))
        assertFalse(isResolvableTimeZone("Mars/Olympus"))
        assertFalse(isResolvableTimeZone("+10:00"))
    }
}
