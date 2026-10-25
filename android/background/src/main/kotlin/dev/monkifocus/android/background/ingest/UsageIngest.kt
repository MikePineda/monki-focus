// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.ingest

import dev.monkifocus.android.core.data.usage.UsageEventsCopy
import dev.monkifocus.android.core.data.usage.UsageEventsSource
import dev.monkifocus.android.core.domain.engine.instantOf
import dev.monkifocus.android.core.domain.engine.utcInstantOf
import dev.monkifocus.android.core.domain.ports.ActivityEventRepository
import dev.monkifocus.android.core.domain.ports.IngestCursorRepository
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * One analytics ingest (plan §2.10), what `UsageIngestWorker` runs every 15
 * minutes and when the app opens:
 *
 * 1. copy the system usage events since the cursor ([UsageEventsCopy]) into
 *    sessions and away periods ([UsageEventsIngest]);
 * 2. recompute the 5-minute blocks ([BlockAggregation]), web heartbeats of
 *    the accessibility service included;
 * 3. purge raw events older than 30 days (blocks are kept).
 *
 * Safe to run again at any time: a second run over the same events adds no
 * row and changes no block. Without usage access nothing is copied and the
 * cursor stays; blocks and the purge still run. Runs never overlap (the
 * periodic worker and the one started when the app opens share this instance).
 */
class UsageIngest(
    private val source: UsageEventsSource,
    private val cursors: IngestCursorRepository,
    private val store: ActivityEventRepository,
    private val aggregation: BlockAggregation,
    private val hostname: String = AndroidBuckets.DEFAULT_HOSTNAME,
) {
    private val running = Mutex()

    suspend fun run(nowMillis: Long): UsageIngestResult = running.withLock { ingest(nowMillis) }

    private suspend fun ingest(nowMillis: Long): UsageIngestResult {
        val sink = UsageEventsIngest(store, cursors, AndroidBuckets(created = instantOf(nowMillis), hostname = hostname), nowMillis)
        val copy =
            UsageEventsCopy(
                source = source,
                cursors = cursors,
                sink = sink,
                overlapMillis = IngestWindow.OVERLAP_MILLIS,
                firstCopyLookbackMillis = IngestWindow.FIRST_LOOKBACK_MILLIS,
            ).run(nowMillis)
        val changedBlocks = aggregation.run(nowMillis)
        val purgeBefore = Math.floorDiv(nowMillis, MILLIS_PER_SECOND) - BlockAggregation.RAW_EVENT_RETENTION_SECONDS
        val purged = store.deleteBefore(utcInstantOf(purgeBefore))
        return UsageIngestResult(
            accessGranted = copy.accessGranted,
            newEvents = sink.newRows,
            changedBlocks = changedBlocks,
            purgedEvents = purged,
        )
    }

    private companion object {
        const val MILLIS_PER_SECOND = 1_000L
    }
}
