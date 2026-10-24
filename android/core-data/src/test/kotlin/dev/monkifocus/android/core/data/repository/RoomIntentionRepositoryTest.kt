// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.repository

import dev.monkifocus.android.core.data.db.MonkiDatabase
import dev.monkifocus.android.core.data.db.inMemoryDatabase
import dev.monkifocus.android.core.domain.ports.Intention
import dev.monkifocus.android.core.domain.ports.IntentionOutcome
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class RoomIntentionRepositoryTest {
    private lateinit var db: MonkiDatabase
    private lateinit var repository: RoomIntentionRepository

    private val intention =
        Intention(
            id = "intention-1",
            targetGroup = "rule-feed",
            minutes = 5,
            typedWords = 4,
            guardianKeyVerified = false,
            startedAt = "2026-10-25T09:00:00Z",
            endsAt = "2026-10-25T09:05:00Z",
        )

    @Before
    fun open() {
        db = inMemoryDatabase()
        repository = RoomIntentionRepository(db.intentions())
    }

    @After
    fun close() = db.close()

    @Test
    fun an_open_intention_round_trips() =
        runTest {
            repository.start(intention)

            assertEquals(intention, repository.open("rule-feed"))
            assertNull(repository.open("rule-other"))
        }

    @Test
    fun an_outcome_is_written_once() =
        runTest {
            repository.start(intention)

            assertTrue(repository.close("intention-1", IntentionOutcome.KEPT, "2026-10-25T09:04:00Z"))
            assertFalse(repository.close("intention-1", IntentionOutcome.BROKEN, "2026-10-25T09:06:00Z"))
            assertFalse(repository.close("intention-unknown", IntentionOutcome.KEPT, "2026-10-25T09:06:00Z"))

            assertNull(repository.open("rule-feed"))
            val closed = repository.startedBetween("2026-10-25T00:00:00Z", "2026-10-26T00:00:00Z").single()
            assertEquals(IntentionOutcome.KEPT, closed.outcome)
            assertEquals("2026-10-25T09:04:00Z", closed.closedAt)
        }

    @Test
    fun started_between_is_half_open_and_ordered() =
        runTest {
            repository.start(intention.copy(id = "late", startedAt = "2026-10-25T10:00:00Z", endsAt = "2026-10-25T10:05:00Z"))
            repository.start(intention)
            repository.start(intention.copy(id = "next-day", startedAt = "2026-10-26T00:00:00Z", endsAt = "2026-10-26T00:05:00Z"))

            val today = repository.startedBetween("2026-10-25T00:00:00Z", "2026-10-26T00:00:00Z")

            assertEquals(listOf("intention-1", "late"), today.map { it.id })
        }
}
