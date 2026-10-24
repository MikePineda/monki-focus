// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.usage

import dev.monkifocus.android.core.domain.ports.IngestCursorRepository
import dev.monkifocus.android.core.domain.usage.DeviceUsageEvent
import dev.monkifocus.android.core.domain.usage.UsageEventKind
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class UsageEventsCopyTest {
    private class FakeSource(
        private val events: List<DeviceUsageEvent>,
    ) : UsageEventsSource {
        val reads = mutableListOf<Pair<Long, Long>>()

        override suspend fun read(
            fromEpochMillis: Long,
            toEpochMillis: Long,
        ): List<DeviceUsageEvent> {
            reads += fromEpochMillis to toEpochMillis
            return events.filter { it.epochMillis in fromEpochMillis until toEpochMillis }
        }
    }

    private class MemoryCursors : IngestCursorRepository {
        val values = mutableMapOf<String, Long>()

        override suspend fun get(source: String): Long? = values[source]

        override suspend fun advance(
            source: String,
            epochMillis: Long,
        ): Long = maxOf(values[source] ?: epochMillis, epochMillis).also { values[source] = it }
    }

    private val day = 24 * 60 * 60 * 1_000L
    private val now = 30 * day
    private val events = listOf(DeviceUsageEvent(UsageEventKind.SCREEN_INTERACTIVE, now - 1_000, null))

    @Test
    fun the_first_copy_reaches_back_seven_days() =
        runTest {
            val source = FakeSource(events)
            val cursors = MemoryCursors()
            val received = mutableListOf<DeviceUsageEvent>()

            val result = UsageEventsCopy(source, cursors, { received += it }).run(now)

            assertEquals(listOf(now - 7 * day to now), source.reads)
            assertEquals(events, received)
            assertEquals(UsageCopyResult(now - 7 * day, now, 1, now), result)
        }

    @Test
    fun later_copies_reread_five_minutes_before_the_cursor() =
        runTest {
            val source = FakeSource(events)
            val cursors = MemoryCursors().apply { values[UsageEventsCopy.CURSOR_SOURCE] = now - day }

            UsageEventsCopy(source, cursors, {}).run(now)

            assertEquals(listOf(now - day - 5 * 60 * 1_000L to now), source.reads)
            assertEquals(now, cursors.values[UsageEventsCopy.CURSOR_SOURCE])
        }

    @Test
    fun the_cursor_stays_when_the_sink_fails() =
        runTest {
            val cursors = MemoryCursors().apply { values[UsageEventsCopy.CURSOR_SOURCE] = now - day }

            val failure = runCatching { UsageEventsCopy(FakeSource(events), cursors, { error("sink down") }).run(now) }

            assertTrue(failure.isFailure)
            assertEquals(now - day, cursors.values[UsageEventsCopy.CURSOR_SOURCE])
        }

    @Test
    fun a_clock_set_back_reads_nothing_and_keeps_the_cursor() =
        runTest {
            val source = FakeSource(events)
            val cursors = MemoryCursors().apply { values[UsageEventsCopy.CURSOR_SOURCE] = now }

            val result = UsageEventsCopy(source, cursors, {}).run(now - day)

            assertEquals(emptyList<Pair<Long, Long>>(), source.reads)
            assertEquals(0, result.eventCount)
            assertEquals(now, cursors.values[UsageEventsCopy.CURSOR_SOURCE])
        }
}
