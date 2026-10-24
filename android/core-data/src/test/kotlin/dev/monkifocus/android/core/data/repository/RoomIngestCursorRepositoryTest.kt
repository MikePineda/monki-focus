// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.repository

import dev.monkifocus.android.core.data.db.MonkiDatabase
import dev.monkifocus.android.core.data.db.inMemoryDatabase
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class RoomIngestCursorRepositoryTest {
    private lateinit var db: MonkiDatabase
    private lateinit var repository: RoomIngestCursorRepository

    @Before
    fun open() {
        db = inMemoryDatabase()
        repository = RoomIngestCursorRepository(db.ingestCursors())
    }

    @After
    fun close() = db.close()

    @Test
    fun a_cursor_only_moves_forward() =
        runTest {
            assertNull(repository.get("usage_events"))

            assertEquals(2_000L, repository.advance("usage_events", 2_000))
            assertEquals(2_000L, repository.advance("usage_events", 1_000))
            assertEquals(3_000L, repository.advance("usage_events", 3_000))

            assertEquals(3_000L, repository.get("usage_events"))
            assertNull(repository.get("other"))
        }
}
