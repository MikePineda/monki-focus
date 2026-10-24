// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.repository

import dev.monkifocus.android.core.data.db.ActivityBlockDao
import dev.monkifocus.android.core.data.db.ActivityBlockEntity
import dev.monkifocus.android.core.data.db.millisOf
import dev.monkifocus.android.core.domain.analytics.ActivityBlock
import dev.monkifocus.android.core.domain.ports.BlockRepository

/** [BlockRepository] over `activity_block`, keyed by the block's natural key. */
class RoomBlockRepository(
    private val dao: ActivityBlockDao,
) : BlockRepository {
    override suspend fun upsert(blocks: List<ActivityBlock>) {
        if (blocks.isNotEmpty()) dao.upsert(blocks.map(ActivityBlockEntity::of))
    }

    override suspend fun replaceRange(
        deviceId: String,
        from: String,
        to: String,
        blocks: List<ActivityBlock>,
    ): List<ActivityBlock> =
        dao.replaceRange(deviceId, millisOf(from), millisOf(to), blocks.map(ActivityBlockEntity::of)).map { it.toDomain() }

    override suspend fun between(
        from: String,
        to: String,
    ): List<ActivityBlock> = dao.between(millisOf(from), millisOf(to)).map { it.toDomain() }
}
