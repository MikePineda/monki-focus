// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.ingest

import dev.monkifocus.android.core.data.usage.UsageEventsCopy
import dev.monkifocus.android.core.data.usage.UsageEventsSink
import dev.monkifocus.android.core.domain.analytics.ActivityEvent
import dev.monkifocus.android.core.domain.analytics.EventData
import dev.monkifocus.android.core.domain.engine.utcInstantOf
import dev.monkifocus.android.core.domain.ports.ActivityEventRepository
import dev.monkifocus.android.core.domain.ports.IngestCursorRepository
import dev.monkifocus.android.core.domain.usage.DeviceUsageEvent

/**
 * The [UsageEventsSink] of one copy run at [nowMillis]: system usage events
 * become `currentwindow` sessions ([ForegroundSessionizer]) and `afkstatus`
 * periods ([AfkSessionizer]) in the event store.
 *
 * Idempotent: the session (and the away period) stored in effect at the
 * window start is carried into the batch, so re-reading the overlap rebuilds
 * the very same rows, and the store keeps one row per natural key with the
 * longer duration. An open session grows in place. [newRows] counts the rows
 * that did not exist before.
 */
class UsageEventsIngest(
    private val store: ActivityEventRepository,
    private val cursors: IngestCursorRepository,
    private val buckets: AndroidBuckets,
    private val nowMillis: Long,
) : UsageEventsSink {
    var newRows: Int = 0
        private set

    override suspend fun accept(events: List<DeviceUsageEvent>) {
        // Called before the copy advances its cursor: this is still the previous one.
        val from = IngestWindow.fromMillis(cursors.get(UsageEventsCopy.CURSOR_SOURCE), nowMillis)
        store.ensureBucket(buckets.window)
        store.ensureBucket(buckets.afk)

        val carriedSession =
            inEffect(buckets.window.id, from)?.let { stored ->
                val app = (stored.data as? EventData.Window)?.app ?: return@let null
                ForegroundSession(app, UsageEventRows.startMillisOf(stored), UsageEventRows.endMillisOf(stored))
            }
        val carriedPeriod =
            inEffect(buckets.afk.id, from)?.let { stored ->
                val status = (stored.data as? EventData.Afk)?.status ?: return@let null
                AfkPeriod(status, UsageEventRows.startMillisOf(stored), UsageEventRows.endMillisOf(stored))
            }

        val sessions = ForegroundSessionizer.sessionize(events, from, nowMillis, carriedSession)
        val periods = AfkSessionizer.periods(events, from, nowMillis, carriedPeriod)
        newRows += store.record(buckets.window.id, sessions.map(UsageEventRows::of).filter { it.duration > 0 })
        newRows += store.record(buckets.afk.id, periods.map(UsageEventRows::of).filter { it.duration > 0 })
    }

    private suspend fun inEffect(
        bucketId: String,
        atMillis: Long,
    ): ActivityEvent? {
        val atSeconds = Math.floorDiv(atMillis, MILLIS_PER_SECOND)
        val recent = store.between(bucketId, utcInstantOf(atSeconds - CARRY_LOOKBACK_SECONDS), utcInstantOf(atSeconds + 1))
        // A long away (or present) stretch can start days earlier; it is then the bucket's latest row.
        val latest = listOfNotNull(store.last(bucketId))
        val candidates = (recent + latest).distinctBy { it.id }.sortedBy { UsageEventRows.startMillisOf(it.event) }
        return UsageEventRows.inEffectAt(candidates.map { it.event }, atMillis)
    }

    private companion object {
        const val MILLIS_PER_SECOND = 1_000L

        /** How far back a row in effect at the window start is looked for (besides the bucket's latest row). */
        const val CARRY_LOOKBACK_SECONDS = 86_400L
    }
}
