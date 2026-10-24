// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.repository

import dev.monkifocus.android.core.data.db.EscalationStateDao
import dev.monkifocus.android.core.data.db.EscalationStateEntity
import dev.monkifocus.android.core.domain.ports.EscalationStateRepository
import dev.monkifocus.android.core.domain.rules.EscalationState

/** [EscalationStateRepository] over `escalation_state`. */
class RoomEscalationStateRepository(
    private val dao: EscalationStateDao,
) : EscalationStateRepository {
    override suspend fun all(): List<EscalationState> = dao.all().map { it.toDomain() }

    override suspend fun get(targetGroup: String): EscalationState? = dao.get(targetGroup)?.toDomain()

    override suspend fun put(state: EscalationState) = putAll(listOf(state))

    override suspend fun putAll(states: List<EscalationState>) {
        require(states.map { it.targetGroup }.toSet().size == states.size) { "One state per target group" }
        dao.upsert(states.map(EscalationStateEntity::of))
    }

    override suspend fun remove(targetGroup: String): Boolean = dao.delete(targetGroup) > 0
}
