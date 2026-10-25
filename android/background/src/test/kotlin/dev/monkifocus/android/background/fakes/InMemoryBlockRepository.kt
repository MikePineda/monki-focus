// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.fakes

import dev.monkifocus.android.core.domain.analytics.ActivityBlock
import dev.monkifocus.android.core.domain.analytics.SYNC_BLOCK_ORDER
import dev.monkifocus.android.core.domain.engine.epochSecondsOf
import dev.monkifocus.android.core.domain.ports.BlockRepository

/** The port's contract in memory, by natural key. */
class InMemoryBlockRepository : BlockRepository {
    private val stored = LinkedHashMap<List<Any?>, ActivityBlock>()

    val all: List<ActivityBlock> get() = stored.values.sortedWith(SYNC_BLOCK_ORDER)

    private fun keyOf(block: ActivityBlock): List<Any?> =
        listOf(block.deviceId, block.blockStart, block.activityKey, block.categoryPath, block.source, block.level)

    override suspend fun upsert(blocks: List<ActivityBlock>) {
        blocks.forEach { stored[keyOf(it)] = it }
    }

    override suspend fun replaceRange(
        deviceId: String,
        from: String,
        to: String,
        blocks: List<ActivityBlock>,
    ): List<ActivityBlock> {
        val start = epochSecondsOf(from)
        val end = epochSecondsOf(to)
        val incoming = blocks.associateBy(::keyOf)
        stored.entries.removeAll { (key, block) ->
            block.deviceId == deviceId && epochSecondsOf(block.blockStart) in start until end && key !in incoming
        }
        val changed = blocks.filter { stored[keyOf(it)] != it }
        upsert(blocks)
        return changed
    }

    override suspend fun between(
        from: String,
        to: String,
    ): List<ActivityBlock> =
        all.filter {
            epochSecondsOf(it.blockStart) >= epochSecondsOf(from) &&
                epochSecondsOf(it.blockStart) < epochSecondsOf(to)
        }
}
