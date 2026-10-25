// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.ingest

import dev.monkifocus.android.core.domain.analytics.AttributedEvent
import dev.monkifocus.android.core.domain.analytics.BLOCK_SECONDS
import dev.monkifocus.android.core.domain.analytics.BlockOptions
import dev.monkifocus.android.core.domain.analytics.toBlocks
import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.core.domain.engine.epochSecondsOf
import dev.monkifocus.android.core.domain.engine.utcInstantOf
import dev.monkifocus.android.core.domain.ports.ActivityEventRepository
import dev.monkifocus.android.core.domain.ports.BlockRepository
import dev.monkifocus.android.core.domain.ports.IngestCursorRepository
import dev.monkifocus.android.core.domain.rules.CategoryAssignment

/**
 * Raw events → local 5-minute blocks (SEMANTICS.md §10.6), like the
 * extension's aggregation job. Each run recomputes the blocks from one block
 * before the last run's watermark up to now with [UsageAttribution] and the
 * analytics core's `toBlocks`, and makes them the device's whole content for
 * that range (`replaceRange`), so a session that grew after the previous run
 * is counted and a second run over the same events writes nothing. Blocks
 * are aligned to UTC 5-minute boundaries; local days come from the rule
 * set's pinned zone when the statistics read them.
 *
 * Local blocks keep the activity key whatever `syncActivityKey` says (that
 * setting governs what a future sync sends, not what this device shows).
 */
class BlockAggregation(
    private val store: ActivityEventRepository,
    private val blocks: BlockRepository,
    private val cursors: IngestCursorRepository,
    private val buckets: AndroidBuckets,
    private val catalog: RulesCatalog,
    private val deviceId: suspend () -> String,
    /** The user's category assignments in force at an instant (the bundled defaults apply on top). */
    private val categories: suspend (now: String) -> List<CategoryAssignment>,
    /** Packages of the device's browsers (whatever opens an http link). */
    private val browserApps: () -> Set<String>,
) {
    /** Recomputes the blocks up to [nowMillis]; answers how many blocks are new or changed. */
    suspend fun run(nowMillis: Long): Int {
        val nowSeconds = Math.floorDiv(nowMillis, MILLIS_PER_SECOND)
        val watermark = cursors.get(WATERMARK_SOURCE)?.let { Math.floorDiv(it, MILLIS_PER_SECOND) - BLOCK_SECONDS }
        val fromSeconds = blockFloor(minOf(watermark ?: (nowSeconds - RAW_EVENT_RETENTION_SECONDS), nowSeconds))
        val toSeconds = blockFloor(nowSeconds) + BLOCK_SECONDS
        val readFrom = utcInstantOf(fromSeconds - EVENT_LOOKBACK_SECONDS)
        val readTo = utcInstantOf(toSeconds)

        val attributed =
            UsageAttribution.attribute(
                windowEvents = store.between(buckets.window.id, readFrom, readTo).map { it.event },
                afkEvents = store.between(buckets.afk.id, readFrom, readTo).map { it.event },
                webEvents = store.between(buckets.web.id, readFrom, readTo).map { it.event },
                browserApps = browserApps(),
                categories = categories(utcInstantOf(nowSeconds)),
                catalog = catalog,
            )
        val device = deviceId()
        val computed =
            toBlocks(attributed.mapNotNull { clipFrom(it, fromSeconds) }, BlockOptions(deviceId = device, syncActivityKey = true))
        val changed = blocks.replaceRange(device, utcInstantOf(fromSeconds), utcInstantOf(toSeconds), computed)
        cursors.advance(WATERMARK_SOURCE, blockFloor(nowSeconds) * MILLIS_PER_SECOND)
        return changed.size
    }

    private fun blockFloor(epochSeconds: Long): Long = Math.floorDiv(epochSeconds, BLOCK_SECONDS.toLong()) * BLOCK_SECONDS

    /** The part of [event] at or after [fromSeconds], or null when none is. */
    private fun clipFrom(
        event: AttributedEvent,
        fromSeconds: Long,
    ): AttributedEvent? {
        val start = epochSecondsOf(event.timestamp)
        val end = start + event.duration
        return when {
            end <= fromSeconds -> null
            start >= fromSeconds -> event
            else -> event.copy(timestamp = utcInstantOf(fromSeconds), duration = (end - fromSeconds).toInt())
        }
    }

    companion object {
        /** The `ingest_cursor` row: the block start up to which blocks are final. */
        const val WATERMARK_SOURCE = "blocks_aggregated"

        /** Raw events are kept this long, so the first run reaches back as far. */
        const val RAW_EVENT_RETENTION_SECONDS = 30 * 86_400L

        /** How long before the window an event may start and still reach into it. */
        private const val EVENT_LOOKBACK_SECONDS = 86_400L
        private const val MILLIS_PER_SECOND = 1_000L
    }
}
