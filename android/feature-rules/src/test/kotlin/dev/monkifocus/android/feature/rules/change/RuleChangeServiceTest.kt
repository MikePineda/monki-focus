// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.change

import dev.monkifocus.android.core.domain.ports.RulesetSource
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.SiteTarget
import dev.monkifocus.android.feature.rules.support.InMemoryRulesetRepository
import dev.monkifocus.android.feature.rules.support.MutableClock
import dev.monkifocus.android.feature.rules.support.RulesData
import dev.monkifocus.android.feature.rules.support.RulesetFactory.aRule
import dev.monkifocus.android.feature.rules.support.RulesetFactory.aRuleset
import dev.monkifocus.android.feature.rules.support.RulesetFactory.withBudget
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The Kotlin twin of the extension's `RuleChangeService.test.ts` (SEMANTICS.md §8). */
class RuleChangeServiceTest {
    private val clock = MutableClock("2026-10-27T10:00:00Z")

    private fun service(
        repository: InMemoryRulesetRepository,
        starter: Ruleset = aRuleset(),
    ) = RuleChangeService(repository, RulesData.catalog, RulesetCheck.of(RulesData.validator), { starter }, clock)

    private fun stored(initial: Ruleset? = aRuleset()) = InMemoryRulesetRepository(initial)

    @Test
    fun tightening_a_rule_applies_immediately() =
        runBlocking {
            val repository = stored()

            val outcome = service(repository).propose(withBudget(aRuleset(), 15), baseRevision = 1)

            assertTrue(outcome is RuleChangeOutcome.Applied)
            assertEquals(
                15,
                repository
                    .active(NOW)!!
                    .ruleset.rules[0]
                    .dailyBudgetMinutes,
            )
            assertNull(repository.pending(NOW))
        }

    @Test
    fun loosening_a_rule_waits_until_the_next_local_midnight() =
        runBlocking {
            val repository = stored()

            val outcome = service(repository).propose(withBudget(aRuleset(), 60), baseRevision = 1)

            // 10:00Z is 12:00 at UTC+2; the next local midnight is 22:00Z.
            assertEquals("2026-10-27T22:00:00Z", (outcome as RuleChangeOutcome.Pending).effectiveFrom)
            assertEquals(
                30,
                repository
                    .active(NOW)!!
                    .ruleset.rules[0]
                    .dailyBudgetMinutes,
            )
            val pending = repository.pending(NOW)!!
            assertEquals("2026-10-27T22:00:00Z", pending.effectiveFrom)
            assertEquals(60, pending.ruleset.rules[0].dailyBudgetMinutes)
            assertEquals(outcome.state.pending, PendingRuleChange(pending.ruleset, pending.effectiveFrom))
        }

    @Test
    fun a_mixed_change_applies_the_tightening_now_and_keeps_the_loosening_pending() =
        runBlocking {
            val repository = stored()
            val proposed =
                withBudget(aRuleset(), 60).let {
                    it.copy(
                        rules =
                            it.rules + aRule("site-other", SiteTarget("other.example"), RuleMode.BLOCK),
                    )
                }

            val outcome = service(repository).propose(proposed, baseRevision = 1)

            assertTrue(outcome is RuleChangeOutcome.Pending)
            assertEquals(
                listOf(Triple("site-example", 30, RuleMode.FRICTION), Triple("site-other", null, RuleMode.BLOCK)),
                repository
                    .active(NOW)!!
                    .ruleset.rules
                    .map { Triple(it.id, it.dailyBudgetMinutes, it.mode) },
            )
        }

    @Test
    fun cancelling_a_pending_loosening_keeps_what_applies_now() =
        runBlocking {
            val repository = stored()
            val service = service(repository)
            service.propose(withBudget(aRuleset(), 60), baseRevision = 1)
            val before = repository.active(NOW)!!.ruleset

            val state = service.cancelPending()

            assertNull(state.pending)
            assertNull(repository.pending(NOW))
            val after = repository.active(NOW)!!.ruleset
            // Same rules; only the revision moves on (stale screens are refused).
            assertEquals(before, after.copy(revision = before.revision, updatedAt = before.updatedAt))
            assertEquals(before.revision + 1, after.revision)
        }

    @Test
    fun turning_bedtime_off_during_bedtime_waits_until_it_ends() =
        runBlocking {
            // 21:30Z is 23:30 local, inside the 22:30–07:00 window: it ends at 05:00Z.
            clock.set("2026-10-27T21:30:00Z")
            val proposed = aRuleset().let { it.copy(bedtime = it.bedtime.copy(enabled = false)) }

            val outcome = service(stored()).propose(proposed, baseRevision = 1)

            assertEquals("2026-10-28T05:00:00Z", (outcome as RuleChangeOutcome.Pending).effectiveFrom)
        }

    @Test
    fun a_later_change_never_brings_a_pending_effective_from_forward() =
        runBlocking {
            clock.set("2026-10-27T21:30:00Z")
            val service = service(stored())
            service.propose(aRuleset().let { it.copy(bedtime = it.bedtime.copy(enabled = false)) }, baseRevision = 1)

            // Bedtime back on, a budget raised instead: alone it would wait for 22:00Z.
            val outcome = service.propose(withBudget(aRuleset(), 60), baseRevision = 2)

            assertEquals("2026-10-28T05:00:00Z", (outcome as RuleChangeOutcome.Pending).effectiveFrom)
        }

    @Test
    fun reverting_every_pending_part_clears_the_pending_change() =
        runBlocking {
            val repository = stored()
            val service = service(repository)
            service.propose(withBudget(aRuleset(), 60), baseRevision = 1)

            val outcome = service.propose(aRuleset(), baseRevision = 2)

            assertTrue(outcome is RuleChangeOutcome.Applied)
            assertNull(repository.pending(NOW))
        }

    @Test
    fun a_pending_change_takes_full_effect_once_its_time_has_come() =
        runBlocking {
            val service = service(stored())
            service.propose(withBudget(aRuleset(), 60), baseRevision = 1)

            clock.set("2026-10-27T21:59:59Z")
            assertEquals(
                30,
                service
                    .state()
                    .effective.rules[0]
                    .dailyBudgetMinutes,
            )

            clock.set("2026-10-27T22:00:00Z")
            val state = service.state()
            assertEquals(60, state.effective.rules[0].dailyBudgetMinutes)
            assertNull(state.pending)
        }

    @Test
    fun every_saved_change_gets_the_next_revision_and_the_current_time() =
        runBlocking {
            val repository = stored()

            service(repository).propose(withBudget(aRuleset(), 15), baseRevision = 1)

            val effective = repository.active(NOW)!!.ruleset
            assertEquals(2, effective.revision)
            assertEquals(NOW, effective.updatedAt)
        }

    @Test
    fun an_invalid_proposal_is_rejected_and_nothing_is_stored() =
        runBlocking {
            val repository = stored()

            val outcome = service(repository).propose(aRuleset(timeZone = "Mars/Olympus"), baseRevision = 1)

            assertEquals(RuleChangeOutcome.Rejected(RuleChangeRejection.INVALID_TIME_ZONE), outcome)
            assertEquals(0, repository.commits)
        }

    @Test
    fun a_proposal_from_a_stale_screen_is_rejected() =
        runBlocking {
            val service = service(stored())
            service.propose(withBudget(aRuleset(), 15), baseRevision = 1)

            val outcome = service.propose(withBudget(aRuleset(), 10), baseRevision = 1)

            assertEquals(RuleChangeOutcome.Rejected(RuleChangeRejection.STALE_REVISION), outcome)
        }

    @Test
    fun without_a_stored_set_the_bundled_starter_is_what_applies_and_what_is_edited() =
        runBlocking {
            val repository = stored(initial = null)
            val service = service(repository, starter = aRuleset())

            assertEquals(aRuleset(), service.state().effective)
            val outcome = service.propose(withBudget(aRuleset(), 15), baseRevision = 1)

            assertTrue(outcome is RuleChangeOutcome.Applied)
            assertEquals(
                15,
                repository
                    .active(NOW)!!
                    .ruleset.rules[0]
                    .dailyBudgetMinutes,
            )
        }

    @Test
    fun the_source_of_a_change_is_recorded() =
        runBlocking {
            val repository = stored()

            service(repository).propose(withBudget(aRuleset(), 15), baseRevision = 1, source = RulesetSource.IMPORT)

            assertEquals(RulesetSource.IMPORT, repository.active(NOW)!!.source)
        }

    @Test
    fun an_edit_proposes_the_transformed_configured_set_against_its_revision() =
        runBlocking {
            val service = service(stored())
            val seen = service.state()

            val outcome = service.edit(seen) { withBudget(it, 60) }
            val stale = service.edit(seen) { withBudget(it, 10) }

            assertEquals(
                60,
                (outcome as RuleChangeOutcome.Pending)
                    .state.configured.rules[0]
                    .dailyBudgetMinutes,
            )
            assertEquals(RuleChangeOutcome.Rejected(RuleChangeRejection.STALE_REVISION), stale)
        }

    private companion object {
        const val NOW = "2026-10-27T10:00:00Z"
    }
}
