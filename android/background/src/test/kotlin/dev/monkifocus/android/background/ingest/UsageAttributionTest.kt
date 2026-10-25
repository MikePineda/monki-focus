// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.ingest

import dev.monkifocus.android.background.fakes.AnalyticsTestData.BROWSER
import dev.monkifocus.android.background.fakes.AnalyticsTestData.MINUTE
import dev.monkifocus.android.background.fakes.AnalyticsTestData.NOTES_APP
import dev.monkifocus.android.background.fakes.AnalyticsTestData.SOCIAL_APP
import dev.monkifocus.android.background.fakes.AnalyticsTestData.T0
import dev.monkifocus.android.background.fakes.AnalyticsTestData.catalog
import dev.monkifocus.android.background.fakes.AnalyticsTestData.web
import dev.monkifocus.android.background.fakes.AnalyticsTestData.window
import dev.monkifocus.android.core.domain.analytics.ActivityEvent
import dev.monkifocus.android.core.domain.analytics.ActivitySource
import dev.monkifocus.android.core.domain.analytics.AfkStatus
import dev.monkifocus.android.core.domain.analytics.AttributedEvent
import dev.monkifocus.android.core.domain.analytics.BROWSER_UNKNOWN
import dev.monkifocus.android.core.domain.analytics.EventData
import dev.monkifocus.android.core.domain.engine.utcInstantOf
import dev.monkifocus.android.core.domain.rules.AppTarget
import dev.monkifocus.android.core.domain.rules.CategoryAssignment
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class UsageAttributionTest {
    private fun attribute(
        windows: List<ActivityEvent>,
        afk: List<ActivityEvent> = emptyList(),
        webs: List<ActivityEvent> = emptyList(),
        categories: List<CategoryAssignment> = emptyList(),
    ) = UsageAttribution.attribute(windows, afk, webs, setOf(BROWSER), categories, catalog)

    private fun secondsBy(events: List<AttributedEvent>): Map<String, Int> =
        events.groupBy { it.activityKey }.mapValues { (_, pieces) -> pieces.sumOf { it.duration } }

    @Test
    fun app_time_is_attributed_to_the_package_with_its_default_level() {
        val events = attribute(listOf(window(T0, 10, SOCIAL_APP), window(T0 + 10 * MINUTE, 5, NOTES_APP)))

        assertEquals(listOf(ActivitySource.ANDROID, ActivitySource.ANDROID), events.map { it.source })
        assertEquals(listOf(0, 100), events.map { it.level })
        assertEquals(mapOf(SOCIAL_APP to 600, NOTES_APP to 300), secondsBy(events))
    }

    @Test
    fun the_users_assignment_beats_the_default() {
        val events =
            attribute(listOf(window(T0, 10, SOCIAL_APP)), categories = listOf(CategoryAssignment(AppTarget(SOCIAL_APP), 75, "chat")))

        assertEquals(75, events.single().level)
        assertEquals("chat", events.single().categoryPath)
    }

    @Test
    fun away_time_never_counts() {
        val away = ActivityEvent(utcInstantOf((T0 + 2 * MINUTE) / 1_000), 3 * 60, EventData.Afk(AfkStatus.AFK))

        val events = attribute(listOf(window(T0, 10, SOCIAL_APP)), afk = listOf(away))

        assertEquals(mapOf(SOCIAL_APP to 420), secondsBy(events))
    }

    @Test
    fun browser_time_with_a_page_goes_to_the_site_and_the_rest_to_unknown_then_the_browser() {
        val events = attribute(listOf(window(T0, 10, BROWSER)), webs = listOf(web(T0, 120, "video.example", "/watch")))

        val site = events.single { it.source == ActivitySource.WEB }
        assertEquals("video.example", site.activityKey)
        assertEquals(0, site.level)
        val seconds = secondsBy(events)
        assertEquals(120, seconds["video.example"])
        assertEquals(UsageAttribution.STALE_AFTER_SECONDS.toInt(), seconds[BROWSER_UNKNOWN])
        assertEquals(600 - 120 - UsageAttribution.STALE_AFTER_SECONDS.toInt(), seconds[BROWSER])
    }

    @Test
    fun a_page_only_counts_while_its_browser_is_in_front() {
        val events =
            attribute(
                listOf(window(T0, 2, BROWSER), window(T0 + 2 * MINUTE, 1, SOCIAL_APP), window(T0 + 3 * MINUTE, 2, BROWSER)),
                webs = listOf(web(T0, 300, "video.example")),
            )

        assertEquals(240, secondsBy(events)["video.example"])
        assertEquals(60, secondsBy(events)[SOCIAL_APP])
        assertTrue("one second counted once", events.sumOf { it.duration } <= 300)
    }
}
