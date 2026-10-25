// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.status

import dev.monkifocus.android.core.domain.rules.Bedtime
import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.Schedule
import dev.monkifocus.android.core.domain.rules.SiteTarget
import dev.monkifocus.android.core.domain.rules.Weekday
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep
import dev.monkifocus.android.feature.onboarding.flow.SetupSnapshot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StatusModelTest {
    @Test
    fun protection_is_active_only_when_turned_on_in_the_app_and_in_settings() {
        fun state(
            service: Boolean = true,
            armed: Boolean = true,
            waiting: Boolean = false,
            ended: Boolean = false,
            statsOnly: Boolean = false,
        ) = ProtectionState.of(service, armed, waiting, ended, statsOnly)

        assertEquals(ProtectionState.ACTIVE, state())
        assertEquals(ProtectionState.SERVICE_OFF, state(service = false))
        assertEquals(ProtectionState.SETUP_UNFINISHED, state(armed = false))
        assertEquals(ProtectionState.STATS_ONLY, state(armed = false, statsOnly = true))
        assertEquals(ProtectionState.EXIT_WAITING, state(waiting = true))
        assertEquals(ProtectionState.ENDED, state(ended = true, armed = false))
        assertFalse(ProtectionState.ACTIVE.canTurnOn)
        assertFalse(ProtectionState.EXIT_WAITING.canTurnOn)
        assertTrue(ProtectionState.ENDED.canTurnOn)
    }

    @Test
    fun a_missing_required_permission_stays_on_top() {
        val snapshot = SetupSnapshot.NOTHING.copy(notifications = true, usageAccess = true)

        val entries = StatusChecklist.of(snapshot, protectionWanted = true)

        assertEquals(
            listOf(
                OnboardingStep.ACCESSIBILITY,
                OnboardingStep.BATTERY,
                OnboardingStep.DEVICE_ADMIN,
                OnboardingStep.NOTIFICATIONS,
                OnboardingStep.USAGE_ACCESS,
            ),
            entries.map { it.step },
        )
        assertEquals(listOf(true, false, false, false, false), entries.map { it.critical })
    }

    @Test
    fun with_statistics_only_nothing_is_critical() {
        assertTrue(StatusChecklist.of(SetupSnapshot.NOTHING, protectionWanted = false).none { it.critical })
    }

    @Test
    fun the_rules_summary_counts_rules_that_are_on_and_names_bedtime_when_on() {
        val ruleset =
            Ruleset(
                schemaVersion = 1,
                revision = 1,
                updatedAt = "2026-10-01T00:00:00Z",
                timeZone = "UTC",
                rules =
                    listOf(
                        Rule("a", SiteTarget("example.com"), RuleMode.BLOCK, emptyList(), enabled = true),
                        Rule("b", SiteTarget("example.org"), RuleMode.BLOCK, emptyList(), enabled = false),
                    ),
                categories = emptyList(),
                bedtime = Bedtime(true, Weekday.entries.toList(), "22:30", "07:00", 30),
                workHours = Schedule(listOf(Weekday.MON), "09:00", "17:00"),
            )

        assertEquals(ActiveRulesSummary(1, "22:30", "07:00", null), ActiveRulesSummary.of(ruleset, null))
        val off = ruleset.copy(bedtime = ruleset.bedtime.copy(enabled = false))
        assertEquals(ActiveRulesSummary(1, null, null, "2026-10-27T22:00:00Z"), ActiveRulesSummary.of(off, "2026-10-27T22:00:00Z"))
    }
}
