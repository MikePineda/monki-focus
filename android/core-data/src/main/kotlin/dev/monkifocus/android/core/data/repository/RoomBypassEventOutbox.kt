// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.repository

import dev.monkifocus.android.core.data.db.BypassEventDao
import dev.monkifocus.android.core.data.db.BypassEventEntity
import dev.monkifocus.android.core.data.db.millisOf
import dev.monkifocus.android.core.domain.ports.BypassEvent
import dev.monkifocus.android.core.domain.ports.BypassEventOutbox

/** [BypassEventOutbox] over `bypass_event`. */
class RoomBypassEventOutbox(
    private val dao: BypassEventDao,
) : BypassEventOutbox {
    override suspend fun enqueue(event: BypassEvent): Boolean = dao.insertOrIgnore(BypassEventEntity.of(event)) != IGNORED

    override suspend fun unreported(limit: Int): List<BypassEvent> {
        require(limit > 0) { "limit must be positive" }
        return dao.unreported(limit).map { it.toDomain() }
    }

    override suspend fun markReported(
        ids: List<String>,
        reportedAt: String,
    ) {
        if (ids.isNotEmpty()) dao.markReported(ids, millisOf(reportedAt))
    }

    override suspend fun occurredBetween(
        from: String,
        to: String,
    ): List<BypassEvent> = dao.occurredBetween(millisOf(from), millisOf(to)).map { it.toDomain() }

    override suspend fun purgeReportedBefore(before: String): Int = dao.purgeReportedBefore(millisOf(before))

    private companion object {
        const val IGNORED = -1L
    }
}
