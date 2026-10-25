// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

/*
 * The sync block (SEMANTICS.md §10.6): [ActivityBlock] is the only analytics
 * record that leaves a device, with exactly the seven [SYNC_BLOCK_FIELDS].
 * Aggregation and capping work on a [BlockDraft] (seconds may still exceed
 * the cap); `toSyncBlock` is the single door from a draft to a block, and
 * the block's constructor rejects values that do not fit the schema.
 */

/** Seconds in a block, and the cap on one block start. */
const val BLOCK_SECONDS: Int = ActivityBlock.BLOCK_SECONDS

/** The seven fields of a synced block, in schema order. */
val SYNC_BLOCK_FIELDS: List<String> =
    listOf("deviceId", "blockStart", "activityKey", "categoryPath", "level", "source", "seconds")

/** A block's fields before the cap: `seconds` may exceed [BLOCK_SECONDS] until it is scaled. */
internal data class BlockDraft(
    val deviceId: String,
    val blockStart: String,
    val activityKey: String?,
    val categoryPath: String,
    val level: Int,
    val source: ActivitySource,
    val seconds: Long,
) {
    /** The block, after checking every field (seconds are rejected, never wrapped, out of range). */
    fun toSyncBlock(): ActivityBlock {
        require(seconds in 1..BLOCK_SECONDS) { "Invalid sync block seconds" }
        return ActivityBlock(deviceId, blockStart, activityKey, categoryPath, level, source, seconds.toInt())
    }

    companion object {
        fun of(block: ActivityBlock): BlockDraft =
            BlockDraft(
                block.deviceId,
                block.blockStart,
                block.activityKey,
                block.categoryPath,
                block.level,
                block.source,
                block.seconds.toLong(),
            )

        /**
         * Canonical block order: `blockStart`, `deviceId`, `activityKey` (null
         * first), `categoryPath`, then `source` (by wire code) and `level`, so
         * the order is total. Strings compare by UTF-16 code unit, like every
         * platform. Within one block start it is also the remainder tie order (§10.9).
         */
        val ORDER: Comparator<BlockDraft> =
            compareBy<BlockDraft> { it.blockStart }
                .thenBy { it.deviceId }
                .thenBy(nullsFirst()) { it.activityKey }
                .thenBy { it.categoryPath }
                .thenBy { it.source.code }
                .thenBy { it.level }
    }
}

/** Canonical block order (§10.6), see [BlockDraft.ORDER]. */
val SYNC_BLOCK_ORDER: Comparator<ActivityBlock> = compareBy(BlockDraft.ORDER, BlockDraft::of)
