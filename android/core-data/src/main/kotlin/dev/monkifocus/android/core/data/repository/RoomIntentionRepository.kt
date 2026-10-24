// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.repository

import dev.monkifocus.android.core.data.db.IntentionDao
import dev.monkifocus.android.core.data.db.IntentionEntity
import dev.monkifocus.android.core.data.db.millisOf
import dev.monkifocus.android.core.domain.ports.Intention
import dev.monkifocus.android.core.domain.ports.IntentionOutcome
import dev.monkifocus.android.core.domain.ports.IntentionRepository

/** [IntentionRepository] over `intention`. */
class RoomIntentionRepository(
    private val dao: IntentionDao,
) : IntentionRepository {
    override suspend fun start(intention: Intention) {
        require(intention.outcome == null) { "A new intention is open" }
        dao.insert(IntentionEntity.of(intention))
    }

    override suspend fun close(
        id: String,
        outcome: IntentionOutcome,
        closedAt: String,
    ): Boolean = dao.close(id, outcome, millisOf(closedAt)) > 0

    override suspend fun open(targetGroup: String): Intention? = dao.open(targetGroup)?.toDomain()

    override suspend fun startedBetween(
        from: String,
        to: String,
    ): List<Intention> = dao.startedBetween(millisOf(from), millisOf(to)).map { it.toDomain() }
}
