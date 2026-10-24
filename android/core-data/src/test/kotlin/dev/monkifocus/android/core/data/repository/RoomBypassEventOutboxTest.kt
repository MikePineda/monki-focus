// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.repository

import dev.monkifocus.android.core.data.db.MonkiDatabase
import dev.monkifocus.android.core.data.db.inMemoryDatabase
import dev.monkifocus.android.core.domain.ports.BypassEvent
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class RoomBypassEventOutboxTest {
    private lateinit var db: MonkiDatabase
    private lateinit var outbox: RoomBypassEventOutbox

    private fun event(
        id: String,
        occurredAt: String,
    ) = BypassEvent(id, "accessibility_disabled", occurredAt, occurredAt, mapOf("minutes_off" to "12"))

    @Before
    fun open() {
        db = inMemoryDatabase()
        outbox = RoomBypassEventOutbox(db.bypassEvents())
    }

    @After
    fun close() = db.close()

    @Test
    fun enqueue_is_idempotent_by_id() =
        runTest {
            assertTrue(outbox.enqueue(event("b-1", "2026-10-25T09:00:00Z")))
            assertFalse(outbox.enqueue(event("b-1", "2026-10-25T09:00:00Z")))

            assertEquals(listOf(event("b-1", "2026-10-25T09:00:00Z")), outbox.unreported(10))
        }

    @Test
    fun reported_events_leave_the_queue_but_stay_in_the_day() =
        runTest {
            outbox.enqueue(event("b-2", "2026-10-25T10:00:00Z"))
            outbox.enqueue(event("b-1", "2026-10-25T09:00:00Z"))

            outbox.markReported(listOf("b-1"), "2026-10-25T11:00:00Z")

            assertEquals(listOf("b-2"), outbox.unreported(10).map { it.id })
            assertEquals(listOf("b-1", "b-2"), outbox.occurredBetween("2026-10-25T00:00:00Z", "2026-10-26T00:00:00Z").map { it.id })
        }

    @Test
    fun purge_never_drops_an_unreported_event() =
        runTest {
            outbox.enqueue(event("b-1", "2026-10-01T09:00:00Z"))
            outbox.enqueue(event("b-2", "2026-10-01T10:00:00Z"))
            outbox.markReported(listOf("b-1"), "2026-10-01T11:00:00Z")

            assertEquals(1, outbox.purgeReportedBefore("2026-10-20T00:00:00Z"))
            assertEquals(listOf("b-2"), outbox.unreported(10).map { it.id })
        }
}
