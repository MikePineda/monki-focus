// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

import dev.monkifocus.android.core.domain.engine.epochSecondsOf
import dev.monkifocus.android.core.domain.engine.utcInstantOf

/*
 * 5-minute blocks (SEMANTICS.md §10.6): each attributed event is cut at UTC
 * 5-minute boundaries and summed per `(blockStart, source, activityKey,
 * categoryPath, level)`. With `syncActivityKey` off the key is null and
 * keys merge. One device's blocks never exceed 300 s per block start. Titles
 * and URLs known locally are never read.
 */

data class BlockOptions(
    val deviceId: String,
    /** Whether blocks carry the domain or app id (off: `activityKey` is null). */
    val syncActivityKey: Boolean,
)

private data class BlockKey(
    val blockStart: String,
    val source: ActivitySource,
    val activityKey: String?,
    val categoryPath: String,
    val level: Int,
)

fun toBlocks(
    events: List<AttributedEvent>,
    options: BlockOptions,
): List<ActivityBlock> {
    val sums = LinkedHashMap<BlockKey, Long>()
    for (event in events) {
        val activityKey = if (options.syncActivityKey) event.activityKey else null
        var cursor = epochSecondsOf(event.timestamp)
        val end = cursor + event.duration
        while (cursor < end) {
            val start = Math.floorDiv(cursor, BLOCK_SECONDS.toLong()) * BLOCK_SECONDS
            val pieceEnd = minOf(start + BLOCK_SECONDS, end)
            val key = BlockKey(utcInstantOf(start), event.source, activityKey, event.categoryPath, event.level)
            sums[key] = (sums[key] ?: 0L) + pieceEnd - cursor
            cursor = pieceEnd
        }
    }
    return capDrafts(
        sums.map { (key, seconds) ->
            BlockDraft(options.deviceId, key.blockStart, key.activityKey, key.categoryPath, key.level, key.source, seconds)
        },
    )
}
