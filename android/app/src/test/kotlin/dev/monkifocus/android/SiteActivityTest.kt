// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import androidx.test.core.app.ApplicationProvider
import dev.monkifocus.android.background.ingest.AndroidBuckets
import dev.monkifocus.android.background.web.KnownSections
import dev.monkifocus.android.background.web.WebHeartbeatRecorder
import dev.monkifocus.android.core.domain.analytics.ActivityBucket
import dev.monkifocus.android.core.domain.analytics.ActivityEvent
import dev.monkifocus.android.core.domain.analytics.EventData
import dev.monkifocus.android.core.domain.analytics.StoredActivityEvent
import dev.monkifocus.android.core.domain.ports.ActivityEventRepository
import dev.monkifocus.android.core.domain.rules.CategoryAssignment
import dev.monkifocus.android.core.domain.rules.SiteTarget
import dev.monkifocus.android.service.accessibility.pipeline.UrlKey
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
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

    private val sections = KnownSections(catalog)

    // Unconfined: the store never suspends, so each write lands before `siteSeen` returns.
    private val recorder =
        WebHeartbeatRecorder(
            store = store,
            bucket = AndroidBuckets(created = "2026-10-25T08:00:00Z").web,
            scope = CoroutineScope(Dispatchers.Unconfined),
            knownSection = sections::allows,
        )

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
    fun an_encoded_space_keeps_only_the_domain() {
        assertEquals("/", pageOf("https://example.com/my%20notes").path)
    }

    @Test
    fun a_segment_over_64_characters_keeps_only_the_domain() {
        assertEquals("/", pageOf("https://example.com/${"a".repeat(65)}").path)
    }

    @Test
    fun a_domain_only_url_bar_keeps_only_the_domain() {
        val key = UrlKey.of("www.youtube.com", catalog)
        assertFalse(key.pathKnown)

        val page = pageOf("www.youtube.com")

        assertEquals("youtube.com", page.domain)
        assertEquals("/", page.path)
        assertNull(page.surface)
    }

    @Test
    fun profile_pages_keep_only_the_domain() {
        listOf(
            "https://x.com/someone" to "x.com",
            "https://www.instagram.com/someone/" to "instagram.com",
            "https://wa.me/15550100123" to "wa.me",
            "https://meet.google.com/abc-defg-hij" to "meet.google.com",
            "https://pastebin.com/AbC123xy" to "pastebin.com",
        ).forEach { (url, domain) ->
            val page = pageOf(url)

            assertEquals(url, domain, page.domain)
            assertEquals(url, "/", page.path)
        }
    }

    @Test
    fun a_section_a_site_profile_names_is_kept_without_the_rest() {
        assertEquals("/r", pageOf("https://www.reddit.com/r/sample/comments/abc/a_title").path)
        assertEquals("/watch", pageOf("https://www.youtube.com/watch?v=abc").path)
    }

    @Test
    fun a_section_the_users_category_rule_names_is_kept() {
        assertEquals("/", pageOf("https://docs.example/handbook/private-notes").path)

        sections.update(listOf(CategoryAssignment(SiteTarget("docs.example", "/handbook/**"), 100, "work")))

        assertEquals("/handbook", pageOf("https://docs.example/handbook/private-notes?q=1#top").path)
    }

    private companion object {
        const val NOW = 1_793_000_000_000L
    }
}
