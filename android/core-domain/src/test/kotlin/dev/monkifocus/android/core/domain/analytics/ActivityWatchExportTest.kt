// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

/** ActivityWatch export and import (aw-server's `/api/0/export` shape), with synthetic data only. */
class ActivityWatchExportTest {
    private val host = "test-host"
    private val created = "2026-10-26T08:00:00Z"

    private fun bucket(
        type: BucketType,
        client: String,
        events: List<ActivityEvent>,
        id: String = activityWatchBucketId(type, host),
    ) = ActivityWatchBucket(ActivityBucket(id, type, client, host, created), events)

    private fun web(
        timestamp: String,
        duration: Int,
        path: String = "/",
        surface: String? = null,
        title: String? = null,
        incognito: Boolean = false,
    ) = ActivityEvent(
        timestamp,
        duration,
        EventData.WebTab("example.org", path, surface, audible = false, incognito = incognito, title = title),
    )

    private val windowBucket =
        bucket(
            BucketType.CURRENT_WINDOW,
            "monki-focus-android",
            listOf(
                ActivityEvent("2026-10-26T09:05:00Z", 120, EventData.Window("org.example.Editor", "Draft")),
                ActivityEvent("2026-10-26T09:00:00Z", 300, EventData.Window("org.example.Editor")),
            ),
        )
    private val afkBucket =
        bucket(
            BucketType.AFK_STATUS,
            "monki-focus-android",
            listOf(ActivityEvent("2026-10-26T09:00:00Z", 420, EventData.Afk(AfkStatus.NOT_AFK))),
        )
    private val webBucket =
        bucket(
            BucketType.WEB_TAB_CURRENT,
            "monki-focus-web",
            listOf(
                web("2026-10-26T09:00:00Z", 60, path = "/docs", surface = "example.docs", title = "Docs"),
                web("2026-10-26T09:01:00Z", 30, incognito = true),
            ),
        )
    private val buckets = listOf(windowBucket, afkBucket, webBucket)

    @Test
    fun aw_export_roundtrips_events() {
        val text = Json.encodeToString(ActivityWatchExport.serializer(), toActivityWatchExport(buckets))
        val parsed = Json.decodeFromString(ActivityWatchExport.serializer(), text)

        assertEquals(buckets.map { it.copy(events = it.events.sortedBy(ActivityEvent::timestamp)) }, fromActivityWatchExport(parsed))
    }

    @Test
    fun aw_export_has_the_aw_server_shape() {
        val exported = toActivityWatchExport(buckets)
        val window = Json.encodeToString(ActivityWatchExport.Bucket.serializer(), exported.buckets.getValue("monki-window_test-host"))

        assertEquals(listOf("monki-window_test-host", "monki-afk_test-host", "monki-web-chrome_test-host"), exported.buckets.keys.toList())
        assertEquals(
            """{"id":"monki-window_test-host","created":"2026-10-26T08:00:00Z","type":"currentwindow","client":"monki-focus-android",""" +
                """"hostname":"test-host","data":{},"events":[""" +
                """{"timestamp":"2026-10-26T09:00:00Z","duration":300,"data":{"app":"org.example.Editor","title":""}},""" +
                """{"timestamp":"2026-10-26T09:05:00Z","duration":120,"data":{"app":"org.example.Editor","title":"Draft"}}]}""",
            window,
        )
        assertEquals(
            JsonObject(
                mapOf(
                    "url" to JsonPrimitive("https://example.org/docs"),
                    "title" to JsonPrimitive("Docs"),
                    "audible" to JsonPrimitive(false),
                    "incognito" to JsonPrimitive(false),
                    "domain" to JsonPrimitive("example.org"),
                    "path" to JsonPrimitive("/docs"),
                    "surface" to JsonPrimitive("example.docs"),
                ),
            ),
            exported.buckets
                .getValue("monki-web-chrome_test-host")
                .events
                .first()
                .data,
        )
    }

    @Test
    fun the_web_bucket_id_names_the_browser_for_the_aw_dashboard() {
        assertEquals("monki-web-brave_test-host", activityWatchBucketId(BucketType.WEB_TAB_CURRENT, host, "brave"))
    }

    @Test
    fun duplicate_bucket_ids_are_rejected() {
        assertThrows(IllegalArgumentException::class.java) { toActivityWatchExport(listOf(afkBucket, afkBucket)) }
    }

    @Test
    fun an_event_that_does_not_fit_its_bucket_type_is_rejected() {
        val misfits =
            listOf(
                BucketType.CURRENT_WINDOW to afkBucket.events.first(),
                BucketType.AFK_STATUS to webBucket.events.first(),
                BucketType.WEB_TAB_CURRENT to windowBucket.events.first(),
            )
        for ((type, event) in misfits) {
            val error =
                assertThrows(IllegalArgumentException::class.java) {
                    toActivityWatchExport(listOf(bucket(type, "monki-focus-android", listOf(event))))
                }
            assertEquals("An event does not fit a ${type.code} bucket", error.message)
        }
    }

    @Test
    fun aw_style_offsets_and_fractional_durations_are_read_as_utc_whole_seconds() {
        val document =
            ActivityWatchExport(
                mapOf(
                    "afk" to
                        ActivityWatchExport.Bucket(
                            id = "afk",
                            created = "2026-10-26T08:00:00.123456+00:00",
                            type = "afkstatus",
                            client = "aw-watcher-afk",
                            hostname = host,
                            data = JsonObject(emptyMap()),
                            events =
                                listOf(
                                    ActivityWatchExport.Event(
                                        "2026-10-26T19:00:00+10:00",
                                        59.6,
                                        JsonObject(mapOf("status" to JsonPrimitive("afk"))),
                                    ),
                                ),
                        ),
                ),
            )

        val bucket = fromActivityWatchExport(document).single()

        assertEquals("2026-10-26T08:00:00Z", bucket.bucket.created)
        assertEquals(listOf(ActivityEvent("2026-10-26T09:00:00Z", 60, EventData.Afk(AfkStatus.AFK))), bucket.events)
    }

    @Test
    fun a_malformed_event_is_rejected() {
        val malformed =
            listOf(
                "afkstatus" to mapOf("status" to JsonPrimitive("away")),
                "afkstatus" to mapOf("status" to JsonPrimitive(true)),
                "currentwindow" to mapOf("title" to JsonPrimitive("x")),
                "web.tab.current" to
                    mapOf(
                        "domain" to JsonPrimitive("example.org"),
                        "path" to JsonPrimitive("/"),
                        "surface" to JsonNull,
                        "audible" to JsonPrimitive("no"),
                    ),
                "web.tab.current" to
                    mapOf("domain" to JsonPrimitive("example.org"), "path" to JsonPrimitive("/"), "surface" to JsonPrimitive(3)),
            )
        for ((type, data) in malformed) {
            val document =
                ActivityWatchExport(
                    mapOf(
                        "bucket" to
                            ActivityWatchExport.Bucket(
                                "bucket",
                                created,
                                type,
                                "monki-focus-web",
                                host,
                                JsonObject(emptyMap()),
                                listOf(ActivityWatchExport.Event("2026-10-26T09:00:00Z", 1.0, JsonObject(data))),
                            ),
                    ),
                )
            assertThrows("$type $data", IllegalArgumentException::class.java) { fromActivityWatchExport(document) }
        }
    }
}
