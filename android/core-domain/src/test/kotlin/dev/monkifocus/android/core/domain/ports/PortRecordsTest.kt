// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

import dev.monkifocus.android.core.domain.analytics.ActivityEvent
import dev.monkifocus.android.core.domain.analytics.EventData
import dev.monkifocus.android.core.domain.rules.Bedtime
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.Schedule
import dev.monkifocus.android.core.domain.rules.Weekday
import dev.monkifocus.android.core.domain.usage.DeviceUsageEvent
import dev.monkifocus.android.core.domain.usage.UsageEventKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

/** The records the ports carry check their own invariants, so no adapter can store a malformed one. */
class PortRecordsTest {
    private val ruleset =
        Ruleset(
            schemaVersion = 1,
            revision = 1,
            updatedAt = "2026-10-25T09:00:00Z",
            timeZone = "Etc/UTC",
            rules = emptyList(),
            categories = emptyList(),
            bedtime = Bedtime(enabled = false, days = listOf(Weekday.MON), start = "23:00", end = "07:00", warnMinutesBefore = 15),
            workHours = Schedule(days = listOf(Weekday.MON), start = "09:00", end = "17:00"),
        )

    @Test
    fun a_change_without_effective_from_applies_whole() {
        val tighter = ruleset.copy(revision = 2)

        assertThrows(IllegalArgumentException::class.java) { RulesetChange(ruleset, tighter, null, RulesetSource.USER) }
        assertEquals(tighter, RulesetChange(tighter, tighter, null, RulesetSource.USER).next)
    }

    @Test
    fun only_activity_usage_events_carry_a_package() {
        assertEquals("com.example.app", DeviceUsageEvent(UsageEventKind.ACTIVITY_RESUMED, 1_000, "com.example.app").packageName)
        assertThrows(IllegalArgumentException::class.java) { DeviceUsageEvent(UsageEventKind.SCREEN_INTERACTIVE, 1_000, "com.example.app") }
        assertThrows(IllegalArgumentException::class.java) { DeviceUsageEvent(UsageEventKind.ACTIVITY_PAUSED, 1_000, null) }
    }

    @Test
    fun activity_events_need_a_utc_instant_and_whole_seconds() {
        assertThrows(IllegalArgumentException::class.java) { ActivityEvent("2026-10-25 09:00", 1, EventData.Window("com.example.app")) }
        assertThrows(
            IllegalArgumentException::class.java,
        ) { ActivityEvent("2026-10-25T09:00:00Z", -1, EventData.Window("com.example.app")) }
    }

    @Test
    fun ledger_entries_are_keyed_by_a_uuid_jti() {
        val window = UnlockWindow("2026-10-25T09:00:00Z", "2026-10-25T09:00:00Z", "2026-10-25T10:00:00Z", 900)
        val entry = UnlockLedgerEntry("0f8fad5b-d9cb-469f-a165-70867728950e", UnlockStatus.RECEIVED, window.exp, window, null, null, false)

        assertEquals(UnlockStatus.RECEIVED, entry.status)
        assertThrows(IllegalArgumentException::class.java) { entry.copy(jti = "not-a-uuid") }
        assertThrows(IllegalArgumentException::class.java) { entry.copy(exp = "2026-10-25T11:00:00Z") }
    }

    @Test
    fun an_intention_outcome_and_its_instant_go_together() {
        val open = Intention("i-1", "rule-1", 5, 0, false, "2026-10-25T09:00:00Z", "2026-10-25T09:05:00Z")

        assertThrows(IllegalArgumentException::class.java) { open.copy(outcome = IntentionOutcome.KEPT) }
        assertEquals(IntentionOutcome.KEPT, open.copy(outcome = IntentionOutcome.KEPT, closedAt = "2026-10-25T09:04:00Z").outcome)
    }

    @Test
    fun unknown_setting_codes_fall_back_to_the_defaults() {
        assertEquals(ThemePreference.SYSTEM, ThemePreference.ofCode("sepia"))
        assertEquals(LanguagePreference.SYSTEM, LanguagePreference.ofCode(null))
        assertEquals(false, Settings().storeTitles)
    }
}
