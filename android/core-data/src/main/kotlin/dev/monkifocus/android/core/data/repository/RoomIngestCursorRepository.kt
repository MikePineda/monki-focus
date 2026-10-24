// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.repository

import dev.monkifocus.android.core.data.db.IngestCursorDao
import dev.monkifocus.android.core.domain.ports.IngestCursorRepository

/** [IngestCursorRepository] over `ingest_cursor`. */
class RoomIngestCursorRepository(
    private val dao: IngestCursorDao,
) : IngestCursorRepository {
    override suspend fun get(source: String): Long? = dao.get(source)

    override suspend fun advance(
        source: String,
        epochMillis: Long,
    ): Long = dao.advance(source, epochMillis)
}
