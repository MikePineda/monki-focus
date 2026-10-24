// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.analytics

import dev.monkifocus.android.core.domain.analytics.AfkStatus
import dev.monkifocus.android.core.domain.analytics.EventData
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class EventDataJsonTest {
    private val web = EventData.WebTab("example.com", "/watch", null, audible = true, incognito = false)

    @Test
    fun encoding_is_canonical_with_sorted_keys() {
        assertEquals("""{"app":"com.example.video"}""", EventDataJson.encode(EventData.Window("com.example.video")))
        assertEquals("""{"status":"not-afk"}""", EventDataJson.encode(EventData.Afk(AfkStatus.NOT_AFK)))
        assertEquals(
            """{"audible":true,"domain":"example.com","incognito":false,"path":"/watch","surface":null}""",
            EventDataJson.encode(web),
        )
    }

    @Test
    fun every_payload_reads_back_unchanged() {
        listOf(
            EventData.Window("com.example.video"),
            EventData.Window("com.example.video", "A title"),
            EventData.Afk(AfkStatus.AFK),
            web,
            web.copy(surface = "example-feed", title = "A page"),
        ).forEach { data -> assertEquals(data, EventDataJson.decode(EventDataJson.encode(data))) }
    }

    @Test
    fun equal_payloads_hash_equal_and_different_ones_differ() {
        val hash = EventDataJson.hashOf(EventDataJson.encode(web))

        assertEquals(64, hash.length)
        assertEquals(hash, EventDataJson.hashOf(EventDataJson.encode(web.copy())))
        assertNotEquals(hash, EventDataJson.hashOf(EventDataJson.encode(web.copy(audible = false))))
    }
}
