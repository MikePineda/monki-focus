// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.repository

import dev.monkifocus.android.core.data.db.MonkiDatabase
import dev.monkifocus.android.core.data.db.UnlockLedgerEntity
import dev.monkifocus.android.core.data.db.inMemoryDatabase
import dev.monkifocus.android.core.domain.ports.MonoBinding
import dev.monkifocus.android.core.domain.ports.UnlockActivation
import dev.monkifocus.android.core.domain.ports.UnlockLedgerEntry
import dev.monkifocus.android.core.domain.ports.UnlockStatus
import dev.monkifocus.android.core.domain.ports.UnlockWindow
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
class RoomUnlockLedgerRepositoryTest {
    private lateinit var db: MonkiDatabase
    private lateinit var repository: RoomUnlockLedgerRepository

    private val window = UnlockWindow("2026-10-25T09:00:00Z", "2026-10-25T09:00:00Z", "2026-10-25T10:00:00Z", 900)
    private val receipt = MonoBinding("boot-1", 5_000, 3_660_000)
    private val received =
        UnlockLedgerEntry(
            jti = "0f8fad5b-d9cb-469f-a165-70867728950e",
            status = UnlockStatus.RECEIVED,
            exp = window.exp,
            window = window,
            receipt = receipt,
            activation = null,
            stale = false,
        )

    @Before
    fun open() {
        db = inMemoryDatabase()
        repository = RoomUnlockLedgerRepository(db.unlockLedger())
    }

    @After
    fun close() = db.close()

    @Test
    fun unlock_ledger_jti_is_unique() =
        runTest {
            db.unlockLedger().insert(UnlockLedgerEntity.of(received))

            val failure =
                runCatching {
                    db.unlockLedger().insert(
                        UnlockLedgerEntity.of(received.copy(status = UnlockStatus.ACTIVE)),
                    )
                }.exceptionOrNull()

            // A primary-key violation on `jti`, whatever the SQLite build words it as.
            assertTrue(failure.toString(), failure?.message.orEmpty().contains("constraint", ignoreCase = true))
            assertEquals(listOf(received), repository.all())
        }

    @Test
    fun receiving_a_jti_again_never_resets_its_entry() =
        runTest {
            val ended = received.copy(status = UnlockStatus.ENDED)
            assertTrue(repository.insert(ended))

            assertFalse(repository.insert(received))
            assertEquals(ended, repository.get(received.jti))
        }

    @Test
    fun an_activated_entry_round_trips_every_field() =
        runTest {
            repository.insert(received)
            val active =
                received.copy(
                    status = UnlockStatus.ACTIVE,
                    activation = UnlockActivation("2026-10-25T09:10:00Z", "2026-10-25T09:25:00Z", MonoBinding("boot-1", 605_000, 900_000)),
                    stale = true,
                )

            assertTrue(repository.update(active))

            assertEquals(active, repository.get(received.jti))
        }

    @Test
    fun a_revocation_of_an_unknown_jti_has_no_window() =
        runTest {
            val revoked =
                UnlockLedgerEntry(
                    "7c9e6679-7425-40de-944b-e07fc1f90ae7",
                    UnlockStatus.REVOKED,
                    "2026-10-25T10:00:00Z",
                    null,
                    null,
                    null,
                    false,
                )

            repository.insert(revoked)

            assertEquals(revoked, repository.get(revoked.jti))
            assertFalse(repository.update(received))
        }

    @Test
    fun purge_removes_listed_jtis_only() =
        runTest {
            repository.insert(received)

            assertEquals(1, repository.delete(listOf(received.jti, "7c9e6679-7425-40de-944b-e07fc1f90ae7")))
            assertNull(repository.get(received.jti))
            assertEquals(0, repository.delete(emptyList()))
        }
}
