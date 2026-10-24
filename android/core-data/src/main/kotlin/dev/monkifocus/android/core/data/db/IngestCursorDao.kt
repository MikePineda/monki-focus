// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert

@Dao
abstract class IngestCursorDao {
    @Query("SELECT last_ts_ms FROM ingest_cursor WHERE source = :source")
    abstract suspend fun get(source: String): Long?

    @Upsert
    abstract suspend fun upsert(row: IngestCursorEntity)

    /** Moves the cursor forward only; answers the stored value. */
    @Transaction
    open suspend fun advance(
        source: String,
        epochMillis: Long,
    ): Long {
        val stored = maxOf(get(source) ?: epochMillis, epochMillis)
        upsert(IngestCursorEntity(source, stored))
        return stored
    }
}
