// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.repository

import dev.monkifocus.android.core.data.db.MonkiDatabase
import dev.monkifocus.android.core.data.db.inMemoryDatabase
import dev.monkifocus.android.core.domain.ports.RulesetChange
import dev.monkifocus.android.core.domain.ports.RulesetSource
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class RoomRulesetRepositoryTest {
    private lateinit var db: MonkiDatabase
    private lateinit var repository: RoomRulesetRepository

    @Before
    fun open() {
        db = inMemoryDatabase()
        repository = RoomRulesetRepository(db.rulesetRevisions())
    }

    @After
    fun close() = db.close()

    private fun whole(revision: Int) = RulesetChange(aRuleset(revision), aRuleset(revision), null, RulesetSource.USER)

    /** `today` is the tightening part (bedtime off, as before); `next` turns bedtime on later. */
    private fun waiting(
        revision: Int,
        effectiveFrom: String,
    ) = RulesetChange(aRuleset(revision), aRuleset(revision, bedtimeEnabled = true), effectiveFrom, RulesetSource.USER)

    @Test
    fun nothing_is_active_before_the_first_commit() =
        runTest {
            assertNull(repository.active("2026-10-25T09:00:00Z"))
            assertNull(repository.pending("2026-10-25T09:00:00Z"))
        }

    @Test
    fun a_whole_change_applies_at_once() =
        runTest {
            val stored = repository.commit(whole(1), "2026-10-25T09:00:00Z")

            assertEquals("2026-10-25T09:00:00Z", stored)
            assertEquals(aRuleset(1), repository.active("2026-10-25T09:00:00Z")?.ruleset)
            assertNull(repository.pending("2026-10-25T09:00:00Z"))
        }

    @Test
    fun active_revision_respects_effective_from() =
        runTest {
            repository.commit(whole(1), "2026-10-25T09:00:00Z")
            repository.commit(waiting(2, "2026-10-26T00:00:00Z"), "2026-10-25T10:00:00Z")

            assertEquals(aRuleset(1), repository.active("2026-10-25T09:30:00Z")?.ruleset)
            assertEquals(aRuleset(2), repository.active("2026-10-25T23:59:59Z")?.ruleset)
            assertEquals(aRuleset(2, bedtimeEnabled = true), repository.pending("2026-10-25T23:59:59Z")?.ruleset)
            assertEquals("2026-10-26T00:00:00Z", repository.pending("2026-10-25T23:59:59Z")?.effectiveFrom)

            val atMidnight = repository.active("2026-10-26T00:00:00Z")
            assertEquals(aRuleset(2, bedtimeEnabled = true), atMidnight?.ruleset)
            assertEquals("2026-10-26T00:00:00Z", atMidnight?.effectiveFrom)
            assertNull(repository.pending("2026-10-26T00:00:00Z"))
        }

    @Test
    fun pending_change_replaced_never_moves_effective_from_earlier() =
        runTest {
            repository.commit(whole(1), "2026-10-25T09:00:00Z")
            repository.commit(waiting(2, "2026-10-27T00:00:00Z"), "2026-10-25T10:00:00Z")

            // A new change replaces the pending one but keeps its later effectiveFrom (SEMANTICS.md §8).
            val stored = repository.commit(waiting(3, "2026-10-26T00:00:00Z"), "2026-10-25T11:00:00Z")

            assertEquals("2026-10-27T00:00:00Z", stored)
            val pending = repository.pending("2026-10-25T11:00:00Z")
            assertEquals(3, pending?.ruleset?.revision)
            assertEquals("2026-10-27T00:00:00Z", pending?.effectiveFrom)
            // Neither the replaced revision 2 nor revision 3's waiting part applies on the earlier date.
            assertEquals(aRuleset(3), repository.active("2026-10-26T12:00:00Z")?.ruleset)
            assertEquals(aRuleset(3, bedtimeEnabled = true), repository.active("2026-10-27T00:00:00Z")?.ruleset)
        }

    @Test
    fun a_whole_change_replaces_the_pending_one() =
        runTest {
            repository.commit(whole(1), "2026-10-25T09:00:00Z")
            repository.commit(waiting(2, "2026-10-26T00:00:00Z"), "2026-10-25T10:00:00Z")

            repository.commit(whole(3), "2026-10-25T11:00:00Z")

            assertNull(repository.pending("2026-10-25T11:00:00Z"))
            assertEquals(aRuleset(3), repository.active("2026-10-26T00:00:00Z")?.ruleset)
        }

    @Test
    fun history_is_append_only() =
        runTest {
            repository.commit(whole(1), "2026-10-25T09:00:00Z")
            repository.commit(waiting(2, "2026-10-26T00:00:00Z"), "2026-10-25T10:00:00Z")
            repository.commit(waiting(3, "2026-10-26T00:00:00Z"), "2026-10-25T11:00:00Z")

            val history = db.rulesetRevisions().history()

            assertEquals(listOf(1, 2, 2, 3, 3), history.map { it.revision })
            assertEquals(1, history.count { it.supersededAt != null })
        }
}
