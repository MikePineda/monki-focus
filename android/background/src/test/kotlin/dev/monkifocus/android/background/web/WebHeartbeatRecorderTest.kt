// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.web

import dev.monkifocus.android.background.fakes.AnalyticsTestData.T0
import dev.monkifocus.android.background.fakes.InMemoryActivityEventRepository
import dev.monkifocus.android.background.ingest.AndroidBuckets
import dev.monkifocus.android.core.domain.analytics.EventData
import dev.monkifocus.android.core.domain.engine.instantOf
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class WebHeartbeatRecorderTest {
    private val store = InMemoryActivityEventRepository()
    private val bucket = AndroidBuckets(created = instantOf(T0)).web

    @Test
    fun a_page_is_recorded_by_domain_and_first_path_segment_only() =
        runTest {
            val recorder = WebHeartbeatRecorder(store, bucket, this)

            recorder.seen("video.example", "watch", "video.watch", T0)
            advanceUntilIdle()

            val data = store.events(bucket.id).single().data as EventData.WebTab
            assertEquals("video.example", data.domain)
            assertEquals("/watch", data.path)
            assertEquals("video.watch", data.surface)
            assertEquals(null, data.title)
        }

    @Test
    fun a_key_no_block_accepts_is_never_recorded() =
        runTest {
            val recorder = WebHeartbeatRecorder(store, bucket, this)

            recorder.seen("", null, null, T0)
            recorder.seen("[::1]", null, null, T0)
            advanceUntilIdle()

            assertTrue(store.all.isEmpty())
        }

    @Test
    fun repeated_readings_of_one_page_grow_one_row() =
        runTest {
            val recorder = WebHeartbeatRecorder(store, bucket, this)

            (0..30 step 3).forEach { second -> recorder.seen("news.example", null, null, T0 + second * 1_000L) }
            advanceUntilIdle()

            val event = store.events(bucket.id).single()
            assertTrue(event.duration >= 20)
        }
}
