// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

/*
 * The 300-second cap on one block start (SEMANTICS.md §10.9, server side,
 * and §10.6, one device): per `blockStart`, blocks adding up to more than
 * 300 s are scaled by largest remainder, ties by `deviceId`, `activityKey`,
 * `categoryPath` (then `source`, `level`); blocks that reach 0 are dropped.
 * Output in canonical block order.
 */

fun capAcrossDevices(blocks: List<ActivityBlock>): List<ActivityBlock> = capDrafts(blocks.map(BlockDraft::of))

/** The cap on drafts, whose seconds may still exceed 300 (one device's sums, §10.6). */
internal fun capDrafts(drafts: List<BlockDraft>): List<ActivityBlock> =
    drafts
        .groupBy { it.blockStart }
        .values
        .flatMap { group ->
            val scaled = scaleToCap(group, BLOCK_SECONDS.toLong(), BlockDraft.ORDER) { it.seconds }
            group.zip(scaled) { draft, seconds -> draft.copy(seconds = seconds) }
        }.filter { it.seconds > 0 }
        .map { it.toSyncBlock() }
        .sortedWith(SYNC_BLOCK_ORDER)
