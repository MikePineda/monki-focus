// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.edit

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** What the user types into the community and time fields. */
class TypedInputTest {
    @Test
    fun a_community_name_is_accepted_with_or_without_its_prefix() {
        assertEquals("AskScience", SubredditName.parse("r/AskScience"))
        assertEquals("AskScience", SubredditName.parse(" /r/AskScience/ "))
        assertEquals("AskScience", SubredditName.parse("AskScience"))
        assertEquals("news", SubredditName.parse("R/news"))
    }

    @Test
    fun anything_that_is_not_a_community_name_is_refused() {
        listOf("", "a", "r/", "has space", "way-too-long-name-for-reddit", "news/hot", "https://reddit.com/r/news").forEach {
            assertNull(it, SubredditName.parse(it))
        }
    }

    @Test
    fun a_wall_clock_time_is_normalised_to_hh_mm() {
        assertEquals("07:05", ClockTime.parse("7:05"))
        assertEquals("22:30", ClockTime.parse(" 22:30 "))
        assertEquals("00:00", ClockTime.parse("0:00"))
    }

    @Test
    fun an_impossible_time_is_refused() {
        listOf("24:00", "12:60", "1230", "12:5", "ab:cd", "").forEach { assertNull(it, ClockTime.parse(it)) }
    }
}
