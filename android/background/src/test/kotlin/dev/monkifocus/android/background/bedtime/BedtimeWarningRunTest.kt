// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.bedtime

import dev.monkifocus.android.background.fakes.InMemoryIngestCursorRepository
import dev.monkifocus.android.core.domain.rules.Bedtime
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.Schedule
import dev.monkifocus.android.core.domain.rules.Weekday
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant

class BedtimeWarningRunTest {
    private val cursors = InMemoryIngestCursorRepository()
    private val warnings = mutableListOf<Int>()
    private val ruleset =
        Ruleset(
            schemaVersion = 1,
            revision = 1,
            updatedAt = "2026-10-01T00:00:00Z",
            timeZone = "Europe/Berlin",
            rules = emptyList(),
            categories = emptyList(),
            bedtime = Bedtime(enabled = true, days = Weekday.entries, start = "22:30", end = "07:00", warnMinutesBefore = 30),
            workHours = Schedule(days = emptyList(), start = "09:00", end = "17:00"),
        )
    private val run = BedtimeWarningRun({ ruleset }, cursors) { warnings += it }

    private fun at(instant: String): Long = Instant.parse(instant).epochSecond

    @Test
    fun the_warning_is_posted_once_per_night_with_the_minutes_left() =
        runTest {
            val next = run.run(at("2026-10-25T21:10:00Z"))
            run.run(at("2026-10-25T21:20:00Z"))

            assertEquals(listOf(20), warnings)
            assertEquals(at("2026-10-26T21:00:00Z"), next)
        }

    @Test
    fun the_next_night_warns_again() =
        runTest {
            run.run(at("2026-10-25T21:10:00Z"))
            run.run(at("2026-10-26T21:05:00Z"))

            assertEquals(listOf(20, 25), warnings)
        }

    @Test
    fun without_a_rule_set_nothing_is_posted_and_it_tries_again_later() =
        runTest {
            val none = BedtimeWarningRun({ null }, cursors) { warnings += it }

            val next = none.run(at("2026-10-25T21:10:00Z"))

            assertEquals(emptyList<Int>(), warnings)
            assertEquals(at("2026-10-25T22:10:00Z"), next)
        }
}
