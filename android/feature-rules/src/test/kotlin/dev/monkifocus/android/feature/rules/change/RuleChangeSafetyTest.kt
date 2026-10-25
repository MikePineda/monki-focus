// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.change

import dev.monkifocus.android.core.domain.ports.RulesetChange
import dev.monkifocus.android.core.domain.ports.RulesetSource
import dev.monkifocus.android.core.domain.rules.CategoryAssignment
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.SiteTarget
import dev.monkifocus.android.feature.rules.support.InMemoryRulesetRepository
import dev.monkifocus.android.feature.rules.support.MutableClock
import dev.monkifocus.android.feature.rules.support.RulesData
import dev.monkifocus.android.feature.rules.support.RulesetFactory.aRule
import dev.monkifocus.android.feature.rules.support.RulesetFactory.aRuleset
import dev.monkifocus.android.feature.rules.support.RulesetFactory.blocks
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** The Kotlin twin of the extension's `RuleChangeSafety.test.ts`: rule changes never loosen early. */
class RuleChangeSafetyTest {
    private val clock = MutableClock(NOW)

    private fun service(repository: InMemoryRulesetRepository) =
        RuleChangeService(repository, RulesData.catalog, RulesetCheck.of(RulesData.validator), { aRuleset() }, clock)

    @Test
    fun a_change_whose_effective_set_would_be_invalid_is_rejected_and_nothing_is_saved() =
        runBlocking {
            // 500 blocks replaced by 500 others in a far-ahead zone: today would need
            // the old ones (removal waits) and the new ones (tightening) = 1000 rules.
            val effective = aRuleset(rules = blocks("old", 500))
            val repository = InMemoryRulesetRepository(effective)

            val outcome = service(repository).propose(aRuleset(rules = blocks("new", 500), timeZone = "Etc/GMT-13"), baseRevision = 1)

            assertEquals(RuleChangeOutcome.Rejected(RuleChangeRejection.TOO_MANY_RULES), outcome)
            assertEquals(effective, repository.active(NOW)!!.ruleset)
            assertNull(repository.pending(NOW))
            assertEquals(0, repository.commits)
        }

    @Test
    fun an_unreadable_stored_set_never_waits_less_than_its_own_zone_midnight() =
        runBlocking {
            // A stored set that fails validation (501 rules) in UTC+2, a proposal in UTC+13.
            val invalid = aRuleset(rules = blocks("old", 501))
            val repository = InMemoryRulesetRepository(invalid)

            val outcome = service(repository).propose(aRuleset(timeZone = "Etc/GMT-13"), baseRevision = 1)

            assertEquals(NORMAL_MIDNIGHT, (outcome as RuleChangeOutcome.Pending).effectiveFrom)
            assertEquals(invalid, repository.active(NOW)!!.ruleset)
        }

    @Test
    fun an_unresolvable_stored_zone_waits_a_full_day() =
        runBlocking {
            val repository = InMemoryRulesetRepository(aRuleset(timeZone = "Mars/Olympus"))

            val outcome = service(repository).propose(aRuleset(), baseRevision = 1)

            assertEquals("2026-10-28T10:00:00Z", (outcome as RuleChangeOutcome.Pending).effectiveFrom)
        }

    @Test
    fun the_fallback_never_moves_a_pending_effective_from_earlier() =
        runBlocking {
            val later = "2026-10-30T05:00:00Z"
            val repository = InMemoryRulesetRepository(aRuleset(rules = blocks("old", 501)))
            // A change recorded earlier that waits until `later`.
            clock.set("2026-10-26T10:00:00Z")
            repository.commit(
                RulesetChange(
                    effectiveToday = aRuleset(rules = blocks("old", 501)),
                    next = aRuleset(),
                    effectiveFrom = later,
                    source = RulesetSource.USER,
                ),
                "2026-10-26T10:00:00Z",
            )
            clock.set(NOW)

            val outcome = service(repository).propose(aRuleset(), baseRevision = 1)

            assertEquals(later, (outcome as RuleChangeOutcome.Pending).effectiveFrom)
        }

    @Test
    fun every_proposal_is_held_to_the_256_kib_document_limit() =
        runBlocking {
            val repository = InMemoryRulesetRepository(aRuleset())
            val huge =
                aRuleset(rules = blocks("big", 500).map { it.copy(note = "n".repeat(140)) }).copy(
                    categories = (0 until 2000).map { CategoryAssignment(SiteTarget("category$it.example"), 0, "social") },
                )

            val outcome = service(repository).propose(huge, baseRevision = 1)

            assertEquals(RuleChangeOutcome.Rejected(RuleChangeRejection.TOO_LARGE), outcome)
            assertEquals(0, repository.commits)
        }

    @Test
    fun cancelling_bumps_the_revision_so_stale_screens_are_refused() =
        runBlocking {
            val service = service(InMemoryRulesetRepository(aRuleset()))
            val looser = aRuleset(rules = listOf(aRule(dailyBudgetMinutes = 60)))
            service.propose(looser, baseRevision = 1)

            val state = service.cancelPending()

            assertEquals(3, state.effective.revision)
            assertEquals(30, state.effective.rules[0].dailyBudgetMinutes)
            assertEquals(RuleChangeOutcome.Rejected(RuleChangeRejection.STALE_REVISION), service.propose(looser, baseRevision = 2))
        }

    @Test
    fun cancelling_a_waiting_time_zone_change_keeps_both_zones_until_it_would_have_applied() =
        runBlocking {
            val service = service(InMemoryRulesetRepository(aRuleset()))
            val proposed = service.propose(aRuleset(timeZone = "Etc/GMT-5"), baseRevision = 1) as RuleChangeOutcome.Pending

            val state = service.cancelPending()

            // Dropping the second zone is a loosening: it waits for the cancelled change's time.
            assertEquals("Etc/GMT-2" to "Etc/GMT-5", state.effective.timeZone to state.effective.pendingTimeZone)
            val pending = state.pending!!
            assertEquals(proposed.effectiveFrom, pending.effectiveFrom)
            assertEquals("Etc/GMT-2", pending.ruleset.timeZone)
            assertNull(pending.ruleset.pendingTimeZone)
            assertEquals(state.effective.revision, pending.ruleset.revision)
            assertEquals(state, service.state())
        }

    @Test
    fun cancelling_without_a_pending_change_changes_nothing() =
        runBlocking {
            val repository = InMemoryRulesetRepository(aRuleset())

            val state = service(repository).cancelPending()

            assertEquals(RulesState(aRuleset(), null), state)
            assertEquals(0, repository.commits)
        }

    @Test
    fun a_third_zone_while_a_zone_change_waits_is_rejected_and_nothing_is_saved() =
        runBlocking {
            val (service, repository) = waitingZoneChange()
            val before = repository.commits

            val outcome = service.propose(aRuleset(timeZone = "Etc/GMT-9"), baseRevision = 2)

            assertEquals(RuleChangeOutcome.Rejected(RuleChangeRejection.ZONE_CHANGE_PENDING), outcome)
            assertEquals(before, repository.commits)
        }

    @Test
    fun the_stored_or_the_waiting_zone_is_still_accepted() =
        runBlocking {
            val (service) = waitingZoneChange()

            val outcome =
                service.propose(
                    aRuleset(timeZone = "Etc/GMT-5", rules = listOf(aRule(dailyBudgetMinutes = 10))),
                    baseRevision = 2,
                )

            assertEquals(true, outcome is RuleChangeOutcome.Pending)
        }

    @Test
    fun a_tightening_saved_after_a_cancel_keeps_both_zones_until_the_removal_is_due() =
        runBlocking {
            val (service, _, zoneFrom) = waitingZoneChange()
            val cancelled = service.cancelPending()

            val outcome = service.propose(tighter(), baseRevision = cancelled.effective.revision)

            assertEquals(zoneFrom, (outcome as RuleChangeOutcome.Pending).effectiveFrom)
            val effective = outcome.state.effective
            assertEquals("Etc/GMT-2" to "Etc/GMT-5", effective.timeZone to effective.pendingTimeZone)
            assertEquals(10, effective.rules[0].dailyBudgetMinutes)
            assertNull(
                outcome.state.pending!!
                    .ruleset.pendingTimeZone,
            )
        }

    @Test
    fun reverting_to_the_old_zone_while_the_change_waits_keeps_both_zones_until_it_was_due() =
        runBlocking {
            val (service, repository, zoneFrom) = waitingZoneChange()

            val outcome = service.propose(tighter(), baseRevision = 2)

            assertEquals(zoneFrom, (outcome as RuleChangeOutcome.Pending).effectiveFrom)
            assertEquals("Etc/GMT-2" to "Etc/GMT-5", outcome.state.effective.timeZone to outcome.state.effective.pendingTimeZone)
            assertEquals(zoneFrom, repository.pending(NOW)!!.effectiveFrom)
        }

    private fun tighter(): Ruleset = aRuleset(rules = listOf(aRule(dailyBudgetMinutes = 10)), revision = 0)

    private suspend fun waitingZoneChange(): Triple<RuleChangeService, InMemoryRulesetRepository, String> {
        val repository = InMemoryRulesetRepository(aRuleset())
        val service = service(repository)
        val proposed = service.propose(aRuleset(timeZone = "Etc/GMT-5"), baseRevision = 1) as RuleChangeOutcome.Pending
        return Triple(service, repository, proposed.effectiveFrom)
    }

    private companion object {
        // 10:00Z: local midnight at UTC+2 (Etc/GMT-2) is 22:00Z; at UTC+13 (Etc/GMT-13) it is 11:00Z.
        const val NOW = "2026-10-27T10:00:00Z"
        const val NORMAL_MIDNIGHT = "2026-10-27T22:00:00Z"
    }
}
