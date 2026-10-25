// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.web

import dev.monkifocus.android.core.domain.analytics.ActivityEvent
import dev.monkifocus.android.core.domain.analytics.EventData
import dev.monkifocus.android.core.domain.engine.utcInstantOf
import org.junit.Assert.assertEquals
import org.junit.Test

class WebHeartbeatBufferTest {
    private val t0 = 1_793_000_000L

    private fun beat(
        at: Long,
        domain: String = "news.example",
        path: String = "/",
    ) = ActivityEvent(utcInstantOf(at), 0, EventData.WebTab(domain, path, null, audible = false, incognito = false))

    @Test
    fun the_first_heartbeat_is_written_at_once() {
        val buffer = WebHeartbeatBuffer(pulsetimeSeconds = 60, flushEverySeconds = 10)

        assertEquals(listOf(beat(t0)), buffer.offer(beat(t0)))
    }

    @Test
    fun heartbeats_of_the_same_page_merge_and_are_written_at_most_every_flush_interval() {
        val buffer = WebHeartbeatBuffer(pulsetimeSeconds = 60, flushEverySeconds = 10)
        buffer.offer(beat(t0))

        assertEquals(emptyList<ActivityEvent>(), buffer.offer(beat(t0 + 4)))
        val written = buffer.offer(beat(t0 + 12))

        assertEquals(listOf(beat(t0).copy(duration = 12)), written)
    }

    @Test
    fun another_page_closes_the_open_event_and_opens_a_new_one() {
        val buffer = WebHeartbeatBuffer(pulsetimeSeconds = 60, flushEverySeconds = 10)
        buffer.offer(beat(t0))
        buffer.offer(beat(t0 + 5))

        val written = buffer.offer(beat(t0 + 8, domain = "docs.example"))

        assertEquals(listOf(beat(t0).copy(duration = 5), beat(t0 + 8, domain = "docs.example")), written)
    }

    @Test
    fun a_silence_longer_than_the_pulsetime_opens_a_new_event_and_writes_nothing_twice() {
        val buffer = WebHeartbeatBuffer(pulsetimeSeconds = 60, flushEverySeconds = 10)
        buffer.offer(beat(t0))

        val written = buffer.offer(beat(t0 + 120))

        assertEquals(listOf(beat(t0 + 120)), written)
    }
}
