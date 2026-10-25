// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.change

import dev.monkifocus.android.core.domain.ports.RulesetSource
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.feature.rules.support.InMemoryRulesetRepository
import dev.monkifocus.android.feature.rules.support.MutableClock
import dev.monkifocus.android.feature.rules.support.RulesData
import dev.monkifocus.android.feature.rules.support.RulesetFactory.aRuleset
import dev.monkifocus.android.feature.rules.support.RulesetFactory.withBudget
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** The bundled starter is stored once, pinned to the device zone of that moment (SEMANTICS.md §6.3). */
class StarterPresetTest {
    private val clock = MutableClock("2026-10-27T10:00:00Z")

    /** The starter as `BundledRules` builds it: in whatever zone the device has when the process starts. */
    private var processZone = "UTC"

    private fun service(repository: InMemoryRulesetRepository) =
        RuleChangeService(
            repository,
            RulesData.catalog,
            RulesetCheck.of(RulesData.validator),
            { aRuleset().copy(timeZone = processZone) },
            clock,
        )

    @Test
    fun the_starter_is_stored_once_as_a_preset_in_the_device_zone() =
        runBlocking {
            val repository = InMemoryRulesetRepository()
            val service = service(repository)

            assertTrue(service.ensureStored("Etc/GMT-2"))
            assertFalse("idempotent", service.ensureStored("Etc/GMT-5"))

            val stored = repository.active(NOW)!!
            assertEquals(RulesetSource.PRESET, stored.source)
            assertEquals("Etc/GMT-2", stored.ruleset.timeZone)
            assertEquals(1, repository.commits)
        }

    @Test
    fun a_stored_set_is_never_replaced_by_the_starter() =
        runBlocking {
            val repository = InMemoryRulesetRepository(withBudget(aRuleset(), 15))

            assertFalse(service(repository).ensureStored("Etc/GMT-2"))
            assertEquals(0, repository.commits)
        }

    @Test
    fun a_zone_change_after_arming_does_not_end_starter_bedtime_early() =
        runBlocking {
            // Armed at 21:30Z in UTC+2: bedtime (22:30–07:00 local) ends at 05:00Z.
            clock.set("2026-10-27T21:30:00Z")
            val repository = InMemoryRulesetRepository()
            service(repository).ensureStored("Etc/GMT-2")

            // The device moves to UTC-10 and the process restarts: its starter would be in that zone.
            processZone = "Etc/GMT+10"
            clock.set("2026-10-27T23:00:00Z")
            val restarted = service(repository)
            restarted.ensureStored("Etc/GMT+10")

            val effective: Ruleset = restarted.state().effective
            assertEquals("the pinned zone governs, not the device's", "Etc/GMT-2", effective.timeZone)
            // 01:00 local in the pinned zone: still bedtime; in UTC-10 it would be 13:00, long after it.
            assertTrue(effective.bedtime.enabled)
            assertEquals("22:30" to "07:00", effective.bedtime.start to effective.bedtime.end)
        }

    @Test
    fun an_unresolvable_device_zone_keeps_the_starter_zone() =
        runBlocking {
            val repository = InMemoryRulesetRepository()

            service(repository).ensureStored("Mars/Olympus")

            assertEquals("UTC", repository.active(NOW)!!.ruleset.timeZone)
        }

    private companion object {
        const val NOW = "2026-10-28T10:00:00Z"
    }
}
