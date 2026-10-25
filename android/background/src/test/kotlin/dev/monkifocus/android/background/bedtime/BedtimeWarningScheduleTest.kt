// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.bedtime

import dev.monkifocus.android.core.domain.rules.Bedtime
import dev.monkifocus.android.core.domain.rules.Weekday
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class BedtimeWarningScheduleTest {
    private val zone = "Europe/Berlin"
    private val nightly = Bedtime(enabled = true, days = Weekday.entries, start = "22:30", end = "07:00", warnMinutesBefore = 30)

    private fun at(instant: String): Long = Instant.parse(instant).epochSecond

    @Test
    fun outside_the_warning_the_worker_waits_until_the_next_warning_starts() {
        // 2026-10-25 is a Sunday; Berlin is on UTC+1 after the DST change of that night.
        val plan = BedtimeWarningSchedule.plan(nightly, zone, at("2026-10-25T12:00:00Z"), lastWarnedOnset = null)

        assertFalse(plan.notify)
        assertEquals(at("2026-10-25T21:00:00Z"), plan.nextCheckAt)
    }

    @Test
    fun inside_the_warning_it_notifies_once_and_waits_for_the_next_night() {
        val now = at("2026-10-25T21:10:00Z")

        val plan = BedtimeWarningSchedule.plan(nightly, zone, now, lastWarnedOnset = null)

        assertTrue(plan.notify)
        assertEquals(at("2026-10-25T21:00:00Z"), plan.warningOnset)
        assertEquals(at("2026-10-26T21:00:00Z"), plan.nextCheckAt)
    }

    @Test
    fun a_warning_already_sent_for_this_night_is_not_sent_again() {
        val plan = BedtimeWarningSchedule.plan(nightly, zone, at("2026-10-25T21:20:00Z"), lastWarnedOnset = at("2026-10-25T21:00:00Z"))

        assertFalse(plan.notify)
    }

    @Test
    fun a_run_that_is_late_and_lands_inside_bedtime_does_not_warn() {
        val plan = BedtimeWarningSchedule.plan(nightly, zone, at("2026-10-25T22:00:00Z"), lastWarnedOnset = null)

        assertFalse(plan.notify)
        assertEquals(at("2026-10-26T21:00:00Z"), plan.nextCheckAt)
    }

    @Test
    fun only_the_listed_days_warn() {
        val fridays = nightly.copy(days = listOf(Weekday.FRI))

        val plan = BedtimeWarningSchedule.plan(fridays, zone, at("2026-10-25T12:00:00Z"), lastWarnedOnset = null)

        assertEquals(at("2026-10-30T21:00:00Z"), plan.nextCheckAt)
    }

    @Test
    fun a_disabled_bedtime_or_no_warning_only_checks_again_a_day_later() {
        val now = at("2026-10-25T21:10:00Z")

        listOf(nightly.copy(enabled = false), nightly.copy(warnMinutesBefore = 0)).forEach { bedtime ->
            val plan = BedtimeWarningSchedule.plan(bedtime, zone, now, lastWarnedOnset = null)

            assertFalse(plan.notify)
            assertEquals(now + 86_400, plan.nextCheckAt)
        }
    }
}
