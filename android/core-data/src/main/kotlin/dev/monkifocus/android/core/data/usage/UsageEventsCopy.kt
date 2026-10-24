// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.usage

import dev.monkifocus.android.core.domain.ports.IngestCursorRepository

/**
 * [UsageCopyJob] over a [UsageEventsSource]: reads from the cursor minus
 * [overlapMillis] (so an event the system wrote late is not lost) up to
 * `now`, hands the events to [sink] and only then advances the cursor. The
 * first copy reaches back [firstCopyLookbackMillis]. A wall clock set back
 * before the cursor reads nothing and leaves the cursor where it is.
 */
class UsageEventsCopy(
    private val source: UsageEventsSource,
    private val cursors: IngestCursorRepository,
    private val sink: UsageEventsSink,
    private val overlapMillis: Long = FIVE_MINUTES,
    private val firstCopyLookbackMillis: Long = SEVEN_DAYS,
) : UsageCopyJob {
    override suspend fun run(nowEpochMillis: Long): UsageCopyResult {
        require(nowEpochMillis >= 0) { "nowEpochMillis must be non-negative" }
        val cursor = cursors.get(CURSOR_SOURCE)
        val from = maxOf(0L, if (cursor == null) nowEpochMillis - firstCopyLookbackMillis else cursor - overlapMillis)
        if (cursor != null && nowEpochMillis <= cursor) return UsageCopyResult(from, nowEpochMillis, 0, cursor)
        val events = source.read(from, nowEpochMillis)
        sink.accept(events)
        val stored = cursors.advance(CURSOR_SOURCE, nowEpochMillis)
        return UsageCopyResult(from, nowEpochMillis, events.size, stored)
    }

    companion object {
        /** The `ingest_cursor` row of the usage copy. */
        const val CURSOR_SOURCE = "usage_events"

        const val FIVE_MINUTES = 5 * 60 * 1_000L
        const val SEVEN_DAYS = 7 * 24 * 60 * 60 * 1_000L
    }
}
