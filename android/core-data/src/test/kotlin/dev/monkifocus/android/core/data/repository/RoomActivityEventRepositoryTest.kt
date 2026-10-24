// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.repository

import dev.monkifocus.android.core.data.analytics.EventDataJson
import dev.monkifocus.android.core.data.db.AwEventEntity
import dev.monkifocus.android.core.data.db.MonkiDatabase
import dev.monkifocus.android.core.data.db.inMemoryDatabase
import dev.monkifocus.android.core.data.settings.DataStoreSettingsRepository
import dev.monkifocus.android.core.data.settings.TemporarySettingsStore
import dev.monkifocus.android.core.domain.analytics.ActivityBucket
import dev.monkifocus.android.core.domain.analytics.ActivityEvent
import dev.monkifocus.android.core.domain.analytics.AfkStatus
import dev.monkifocus.android.core.domain.analytics.BucketType
import dev.monkifocus.android.core.domain.analytics.EventData
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class RoomActivityEventRepositoryTest {
    @get:Rule
    val temporary = TemporarySettingsStore()

    private lateinit var db: MonkiDatabase
    private lateinit var settings: DataStoreSettingsRepository
    private lateinit var repository: RoomActivityEventRepository

    private val window =
        ActivityBucket("aw-watcher-android_phone", BucketType.CURRENT_WINDOW, "monki-focus-android", "phone", "2026-10-25T08:00:00Z")
    private val web =
        ActivityBucket("aw-watcher-android-web_phone", BucketType.WEB_TAB_CURRENT, "monki-focus-android", "phone", "2026-10-25T08:00:00Z")

    private fun app(
        at: String,
        seconds: Int,
        title: String? = null,
    ) = ActivityEvent(at, seconds, EventData.Window("com.example.video", title))

    @Before
    fun open() =
        runTest {
            db = inMemoryDatabase()
            settings = DataStoreSettingsRepository(temporary.store) { "device-1" }
            repository = RoomActivityEventRepository(db.activityWatch(), settings)
            repository.ensureBucket(window)
            repository.ensureBucket(web)
        }

    @After
    fun close() = db.close()

    @Test
    fun aw_event_unique_index_rejects_duplicate() =
        runTest {
            val json = EventDataJson.encode(EventData.Window("com.example.video"))
            val row =
                AwEventEntity(
                    bucketId = window.id,
                    timestampMs = 1_000,
                    durationMs = 5_000,
                    data = json,
                    dataHash = EventDataJson.hashOf(json),
                )
            db.activityWatch().insert(row)

            val failure = runCatching { db.activityWatch().insert(row.copy(durationMs = 9_000)) }.exceptionOrNull()

            // "UNIQUE constraint failed: aw_event.bucket_id, aw_event.timestamp_ms, aw_event.data_hash".
            assertTrue(failure.toString(), failure?.message.orEmpty().contains("constraint", ignoreCase = true))
            assertEquals(1, repository.between(window.id, "1970-01-01T00:00:00Z", "1970-01-02T00:00:00Z").size)
        }

    @Test
    fun recording_the_same_events_twice_changes_nothing() =
        runTest {
            val events = listOf(app("2026-10-25T09:00:00Z", 60), ActivityEvent("2026-10-25T09:01:00Z", 30, EventData.Afk(AfkStatus.AFK)))

            assertEquals(2, repository.record(window.id, events))
            assertEquals(0, repository.record(window.id, events))

            assertEquals(events, repository.between(window.id, "2026-10-25T00:00:00Z", "2026-10-26T00:00:00Z").map { it.event })
        }

    @Test
    fun a_heartbeat_extension_keeps_the_longest_duration() =
        runTest {
            repository.record(window.id, listOf(app("2026-10-25T09:00:00Z", 60)))
            repository.record(window.id, listOf(app("2026-10-25T09:00:00Z", 90)))
            repository.record(window.id, listOf(app("2026-10-25T09:00:00Z", 30)))

            assertEquals(90, repository.last(window.id)?.event?.duration)
        }

    @Test
    fun titles_not_stored_by_default() =
        runTest {
            repository.record(window.id, listOf(app("2026-10-25T09:00:00Z", 60, title = "Private video title")))
            repository.record(
                web.id,
                listOf(
                    ActivityEvent(
                        "2026-10-25T09:00:00Z",
                        60,
                        EventData.WebTab("example.com", "/watch", null, false, false, "Private page title"),
                    ),
                ),
            )

            assertNull((repository.last(window.id)?.event?.data as EventData.Window).title)
            assertNull((repository.last(web.id)?.event?.data as EventData.WebTab).title)
        }

    @Test
    fun titles_are_stored_only_while_the_setting_is_on_and_never_for_incognito() =
        runTest {
            settings.update { it.copy(storeTitles = true) }

            repository.record(window.id, listOf(app("2026-10-25T09:00:00Z", 60, title = "Video")))
            repository.record(
                web.id,
                listOf(
                    ActivityEvent("2026-10-25T09:00:00Z", 60, EventData.WebTab("example.com", "/", null, false, true, "Incognito page")),
                ),
            )

            assertEquals("Video", (repository.last(window.id)?.event?.data as EventData.Window).title)
            assertNull((repository.last(web.id)?.event?.data as EventData.WebTab).title)
        }

    @Test
    fun web_paths_are_stored_as_their_first_segment_only() =
        runTest {
            val event =
                ActivityEvent(
                    "2026-10-25T09:00:00Z",
                    60,
                    EventData.WebTab("example.com", "/watch/abc123?t=10#top", "example-feed", true, false),
                )

            repository.record(web.id, listOf(event))

            val stored = repository.last(web.id)?.event?.data as EventData.WebTab
            assertEquals("example.com", stored.domain)
            assertEquals("/watch", stored.path)
            assertEquals("example-feed", stored.surface)
        }

    @Test
    fun delete_before_removes_old_events_of_every_bucket() =
        runTest {
            repository.record(window.id, listOf(app("2026-09-01T09:00:00Z", 60), app("2026-10-25T09:00:00Z", 60)))

            assertEquals(1, repository.deleteBefore("2026-10-01T00:00:00Z"))
            assertEquals(
                listOf("2026-10-25T09:00:00Z"),
                repository.between(window.id, "2026-01-01T00:00:00Z", "2027-01-01T00:00:00Z").map {
                    it.event.timestamp
                },
            )
        }

    @Test
    fun ensure_bucket_keeps_the_existing_bucket() =
        runTest {
            repository.ensureBucket(window.copy(hostname = "renamed", created = "2026-10-26T00:00:00Z"))

            assertEquals(listOf(web, window), repository.buckets())
        }
}
