// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import androidx.test.core.app.ApplicationProvider
import dev.monkifocus.android.background.ingest.AndroidBuckets
import dev.monkifocus.android.background.web.WebHeartbeatRecorder
import dev.monkifocus.android.core.domain.analytics.ActivityBucket
import dev.monkifocus.android.core.domain.analytics.ActivityEvent
import dev.monkifocus.android.core.domain.analytics.EventData
import dev.monkifocus.android.core.domain.analytics.StoredActivityEvent
import dev.monkifocus.android.core.domain.ports.ActivityEventRepository
import dev.monkifocus.android.service.accessibility.pipeline.UrlKey
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/** What a URL-bar reading leaves in the statistics store: the domain, and a first segment only when it is plain. */
@RunWith(RobolectricTestRunner::class)
class SiteActivityTest {
    private val catalog =
        ApplicationProvider
            .getApplicationContext<MonkiApplication>()
            .graph.rules.catalog
    private val stored = mutableListOf<ActivityEvent>()
    private val store =
        object : ActivityEventRepository {
            override suspend fun ensureBucket(bucket: ActivityBucket) = Unit

            override suspend fun buckets(): List<ActivityBucket> = emptyList()

            override suspend fun record(
                bucketId: String,
                events: List<ActivityEvent>,
            ): Int {
                stored += events
                return events.size
            }

            override suspend fun between(
                bucketId: String,
                from: String,
                to: String,
            ): List<StoredActivityEvent> = emptyList()

            override suspend fun last(bucketId: String): StoredActivityEvent? = null

            override suspend fun deleteBefore(before: String): Int = 0
        }

    // Unconfined: the store never suspends, so each write lands before `siteSeen` returns.
    private val recorder =
        WebHeartbeatRecorder(store, AndroidBuckets(created = "2026-10-25T08:00:00Z").web, CoroutineScope(Dispatchers.Unconfined))

    private fun pageOf(url: String): EventData.WebTab {
        stored.clear()
        recorder.siteSeen(UrlKey.of(url, catalog), NOW)
        return stored.last().data as EventData.WebTab
    }

    @Test
    fun an_encoded_path_keeps_only_the_domain() {
        val page = pageOf("https://example.com/files%2Fprivate%2Fmy-medical-report?x=1")

        assertEquals("example.com", page.domain)
        assertEquals("/", page.path)
    }

    @Test
    fun a_path_parameter_keeps_only_the_domain() {
        val page = pageOf("https://example.com/;jsessionid=opaque0123/inbox")

        assertEquals("example.com", page.domain)
        assertEquals("/", page.path)
    }

    @Test
    fun a_plain_first_segment_is_kept_without_the_rest() {
        val page = pageOf("https://example.com/docs/private-notes?q=1#top")

        assertEquals("/docs", page.path)
    }

    private companion object {
        const val NOW = 1_793_000_000_000L
    }
}
