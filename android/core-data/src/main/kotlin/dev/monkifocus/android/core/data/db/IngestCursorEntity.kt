// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/** How far an ingest source has been copied, epoch milliseconds. */
@Entity(tableName = MonkiTables.INGEST_CURSOR)
data class IngestCursorEntity(
    @PrimaryKey val source: String,
    @ColumnInfo(name = "last_ts_ms") val lastTsMs: Long,
)
