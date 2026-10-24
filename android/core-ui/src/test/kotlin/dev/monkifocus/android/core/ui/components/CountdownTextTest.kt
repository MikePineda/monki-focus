// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CountdownTextTest {
    @Test
    fun seconds_under_a_minute_read_as_a_bare_number_with_a_unit() {
        assertEquals("12", CountdownText.digits(12))
        assertEquals("59", CountdownText.digits(59))
        assertTrue(CountdownText.showsUnit(12))
    }

    @Test
    fun a_minute_or_more_reads_as_minutes_and_padded_seconds() {
        assertEquals("1:00", CountdownText.digits(60))
        assertEquals("1:47", CountdownText.digits(107))
        assertEquals("2:00", CountdownText.digits(120))
        assertEquals("1:05", CountdownText.digits(65))
        assertFalse(CountdownText.showsUnit(120))
    }

    @Test
    fun negative_time_reads_as_zero() {
        assertEquals("0", CountdownText.digits(-3))
        assertEquals(0, CountdownText.announcementWindow(-3))
    }

    @Test
    fun announcements_change_at_most_once_every_five_seconds() {
        val windows = (15 downTo 1).map { CountdownText.announcementWindow(it) }

        assertEquals(listOf(3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1), windows)
        assertEquals(0, CountdownText.announcementWindow(0))
    }
}
