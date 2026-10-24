// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.repository

import dev.monkifocus.android.core.data.db.MonkiDatabase
import dev.monkifocus.android.core.data.db.inMemoryDatabase
import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.EscalationState
import dev.monkifocus.android.core.domain.rules.FrictionType
import dev.monkifocus.android.core.domain.rules.Gate
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
class RoomEscalationStateRepositoryTest {
    private lateinit var db: MonkiDatabase
    private lateinit var repository: RoomEscalationStateRepository

    private val idle =
        EscalationState(
            targetGroup = "rule-feed",
            phase = EscalationPhase.IDLE,
            attemptCount = 0,
            lastAttemptAt = null,
            lastActivityAt = null,
            brokenCount = 0,
            lastFrictionType = null,
            gate = null,
            pauseEndsAt = null,
            pendingExtension = false,
            intentionExpiresAt = null,
            overrideReadyAt = null,
            overrideEndsAt = null,
        )

    private val active =
        idle.copy(
            phase = EscalationPhase.ACTIVE,
            attemptCount = 3,
            lastAttemptAt = "2026-10-25T09:00:00Z",
            lastActivityAt = "2026-10-25T09:00:20Z",
            brokenCount = 1,
            lastFrictionType = FrictionType.TYPE_INTENTION,
            gate =
                Gate(
                    level = 2,
                    pauseSeconds = 30,
                    frictionType = FrictionType.TYPE_INTENTION,
                    requiresTypedIntention = true,
                    requiresGuardianKey = false,
                ),
            pauseEndsAt = "2026-10-25T09:00:30Z",
            pendingExtension = true,
            intentionExpiresAt = "2026-10-25T09:05:20Z",
        )

    @Before
    fun open() {
        db = inMemoryDatabase()
        repository = RoomEscalationStateRepository(db.escalationStates())
    }

    @After
    fun close() = db.close()

    @Test
    fun escalation_state_round_trips_every_field() =
        runTest {
            repository.put(active)
            repository.put(idle.copy(targetGroup = "bedtime"))

            assertEquals(active, repository.get("rule-feed"))
            assertEquals(idle.copy(targetGroup = "bedtime"), repository.get("bedtime"))
            assertEquals(listOf("bedtime", "rule-feed"), repository.all().map { it.targetGroup })
        }

    @Test
    fun a_state_without_gate_reads_back_without_gate() =
        runTest {
            repository.put(active)
            repository.put(active.copy(gate = null, phase = EscalationPhase.TIMED_OUT))

            val stored = repository.get("rule-feed")
            assertNull(stored?.gate)
            assertEquals(EscalationPhase.TIMED_OUT, stored?.phase)
        }

    @Test
    fun removing_a_group_forgets_it() =
        runTest {
            repository.putAll(listOf(active, idle.copy(targetGroup = "rule-other")))

            assertTrue(repository.remove("rule-feed"))
            assertFalse(repository.remove("rule-feed"))
            assertEquals(listOf("rule-other"), repository.all().map { it.targetGroup })
        }
}
