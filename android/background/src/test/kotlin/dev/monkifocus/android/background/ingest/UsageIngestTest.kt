// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.ingest

import dev.monkifocus.android.background.fakes.AnalyticsTestData.BROWSER
import dev.monkifocus.android.background.fakes.AnalyticsTestData.MINUTE
import dev.monkifocus.android.background.fakes.AnalyticsTestData.NOTES_APP
import dev.monkifocus.android.background.fakes.AnalyticsTestData.SOCIAL_APP
import dev.monkifocus.android.background.fakes.AnalyticsTestData.T0
import dev.monkifocus.android.background.fakes.AnalyticsTestData.catalog
import dev.monkifocus.android.background.fakes.AnalyticsTestData.paused
import dev.monkifocus.android.background.fakes.AnalyticsTestData.resumed
import dev.monkifocus.android.background.fakes.AnalyticsTestData.screenOff
import dev.monkifocus.android.background.fakes.AnalyticsTestData.screenOn
import dev.monkifocus.android.background.fakes.AnalyticsTestData.web
import dev.monkifocus.android.background.fakes.AnalyticsTestData.window
import dev.monkifocus.android.background.fakes.FakeUsageEventsSource
import dev.monkifocus.android.background.fakes.InMemoryActivityEventRepository
import dev.monkifocus.android.background.fakes.InMemoryBlockRepository
import dev.monkifocus.android.background.fakes.InMemoryIngestCursorRepository
import dev.monkifocus.android.core.domain.analytics.ActivitySource
import dev.monkifocus.android.core.domain.analytics.AfkStatus
import dev.monkifocus.android.core.domain.analytics.EventData
import dev.monkifocus.android.core.domain.engine.instantOf
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UsageIngestTest {
    private val source = FakeUsageEventsSource()
    private val cursors = InMemoryIngestCursorRepository()
    private val store = InMemoryActivityEventRepository()
    private val blocks = InMemoryBlockRepository()
    private val buckets = AndroidBuckets(created = instantOf(T0))
    private val ingest =
        UsageIngest(
            source,
            cursors,
            store,
            BlockAggregation(store, blocks, cursors, buckets, catalog, { "device-1" }, { emptyList() }, { setOf(BROWSER) }),
        )

    private fun secondsByKey() = blocks.all.groupBy { it.activityKey }.mapValues { (_, b) -> b.sumOf { it.seconds } }

    @Test
    fun usage_events_become_sessions_away_periods_and_blocks() =
        runTest {
            source.events =
                listOf(
                    resumed(T0, SOCIAL_APP),
                    paused(T0 + 10 * MINUTE, SOCIAL_APP),
                    resumed(T0 + 10 * MINUTE, NOTES_APP),
                    screenOff(T0 + 15 * MINUTE),
                    screenOn(T0 + 40 * MINUTE),
                )

            val result = ingest.run(T0 + 45 * MINUTE)

            assertTrue(result.accessGranted)
            assertEquals(listOf(window(T0, 10, SOCIAL_APP), window(T0 + 10 * MINUTE, 5, NOTES_APP)), store.events(buckets.window.id))
            assertEquals(
                listOf(AfkStatus.NOT_AFK, AfkStatus.AFK, AfkStatus.NOT_AFK),
                store.events(buckets.afk.id).map { (it.data as EventData.Afk).status },
            )
            assertEquals(mapOf(SOCIAL_APP to 600, NOTES_APP to 300), secondsByKey())
            assertTrue(blocks.all.all { it.source == ActivitySource.ANDROID && it.deviceId == "device-1" })
        }

    @Test
    fun re_running_the_ingest_adds_no_row_and_changes_no_block() =
        runTest {
            source.events = listOf(resumed(T0, SOCIAL_APP), paused(T0 + 10 * MINUTE, SOCIAL_APP))
            ingest.run(T0 + 20 * MINUTE)
            val rows = store.all
            val stored = blocks.all

            val again = ingest.run(T0 + 20 * MINUTE)
            val later = ingest.run(T0 + 21 * MINUTE)

            assertEquals(0, again.newEvents)
            assertEquals(0, again.changedBlocks)
            assertEquals(0, later.newEvents)
            assertEquals(0, later.changedBlocks)
            assertEquals(rows.map { it.id }, store.all.map { it.id })
            assertEquals(rows.filter { it.bucketId == buckets.window.id }, store.all.filter { it.bucketId == buckets.window.id })
            assertEquals(stored, blocks.all)
        }

    @Test
    fun replaying_the_same_events_from_scratch_rebuilds_the_same_rows() =
        runTest {
            source.events = listOf(resumed(T0, SOCIAL_APP), paused(T0 + 10 * MINUTE, SOCIAL_APP), resumed(T0 + 12 * MINUTE, NOTES_APP))
            ingest.run(T0 + 20 * MINUTE)
            val rows = store.all.map { it.event }

            // The cursor is lost (a reinstall of the cursor table, a clock step): everything is read again.
            cursors.values.clear()
            val replay = ingest.run(T0 + 20 * MINUTE)

            assertEquals(0, replay.newEvents)
            assertEquals(rows, store.all.map { it.event })
        }

    @Test
    fun an_app_still_in_front_grows_in_place_across_runs() =
        runTest {
            source.events = listOf(resumed(T0, SOCIAL_APP))
            ingest.run(T0 + 20 * MINUTE)
            source.events = source.events + paused(T0 + 50 * MINUTE, SOCIAL_APP)

            val second = ingest.run(T0 + 60 * MINUTE)

            assertEquals(0, second.newEvents)
            assertEquals(listOf(window(T0, 50, SOCIAL_APP)), store.events(buckets.window.id))
            assertEquals(3_000, secondsByKey()[SOCIAL_APP])
        }

    @Test
    fun a_session_open_across_several_runs_without_events_keeps_one_row() =
        runTest {
            source.events = listOf(resumed(T0, SOCIAL_APP))
            ingest.run(T0 + 20 * MINUTE)
            ingest.run(T0 + 40 * MINUTE)
            ingest.run(T0 + 60 * MINUTE)

            assertEquals(listOf(window(T0, 60, SOCIAL_APP)), store.events(buckets.window.id))
        }

    @Test
    fun without_usage_access_nothing_is_copied_and_the_cursor_stays() =
        runTest {
            source.granted = false
            source.events = listOf(resumed(T0, SOCIAL_APP))

            val result = ingest.run(T0 + 20 * MINUTE)

            assertFalse(result.accessGranted)
            assertEquals(0, result.newEvents)
            assertEquals(null, cursors.values["usage_events"])
            assertTrue(store.all.isEmpty())
        }

    @Test
    fun raw_events_older_than_thirty_days_are_purged_and_blocks_stay() =
        runTest {
            source.events = listOf(resumed(T0, SOCIAL_APP), paused(T0 + 10 * MINUTE, SOCIAL_APP))
            ingest.run(T0 + 20 * MINUTE)
            val stored = blocks.all

            val later = T0 + 31L * 24 * 60 * MINUTE
            source.events = emptyList()
            val result = ingest.run(later)

            assertTrue(result.purgedEvents > 0)
            assertTrue(store.events(buckets.window.id).isEmpty())
            assertEquals(stored, blocks.all)
        }

    @Test
    fun browser_pages_seen_by_the_service_join_the_blocks() =
        runTest {
            store.ensureBucket(buckets.web)
            store.record(buckets.web.id, listOf(web(T0, 120, "video.example", "/watch")))
            source.events = listOf(resumed(T0, BROWSER), paused(T0 + 2 * MINUTE, BROWSER))

            ingest.run(T0 + 10 * MINUTE)

            val site = blocks.all.single { it.source == ActivitySource.WEB }
            assertEquals("video.example", site.activityKey)
            assertEquals(120, site.seconds)
        }
}
