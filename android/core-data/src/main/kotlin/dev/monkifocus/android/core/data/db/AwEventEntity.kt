// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * One ActivityWatch event. `data` is the canonical JSON of the event payload
 * after the privacy reduction and `data_hash` its SHA-256, so the unique
 * index `(bucket_id, timestamp_ms, data_hash)` is the event's natural key: the
 * same minute is never stored twice. `synced_at` is reserved for a later
 * export or sync and stays null for now.
 */
@Entity(
    tableName = MonkiTables.AW_EVENT,
    foreignKeys = [
        ForeignKey(
            entity = AwBucketEntity::class,
            parentColumns = ["id"],
            childColumns = ["bucket_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [
        Index(value = ["bucket_id", "timestamp_ms", "data_hash"], unique = true),
        Index(value = ["timestamp_ms"]),
    ],
)
data class AwEventEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "bucket_id") val bucketId: String,
    @ColumnInfo(name = "timestamp_ms") val timestampMs: Long,
    @ColumnInfo(name = "duration_ms") val durationMs: Long,
    val data: String,
    @ColumnInfo(name = "data_hash") val dataHash: String,
    @ColumnInfo(name = "synced_at") val syncedAt: Long? = null,
)
