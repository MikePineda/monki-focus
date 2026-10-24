// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction

/** Buckets and events of the ActivityWatch-compatible store. */
@Dao
abstract class ActivityWatchDao {
    /** Keeps an existing bucket untouched; answers -1 then. */
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    abstract suspend fun insertBucket(row: AwBucketEntity): Long

    @Query("SELECT * FROM aw_bucket ORDER BY id")
    abstract suspend fun buckets(): List<AwBucketEntity>

    /** Strict insert: a duplicate natural key aborts. */
    @Insert
    abstract suspend fun insert(row: AwEventEntity): Long

    /** Answers -1 when the natural key is already stored. */
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    abstract suspend fun insertOrIgnore(row: AwEventEntity): Long

    @Query(
        "UPDATE aw_event SET duration_ms = MAX(duration_ms, :durationMs) " +
            "WHERE bucket_id = :bucketId AND timestamp_ms = :timestampMs AND data_hash = :dataHash",
    )
    abstract suspend fun extend(
        bucketId: String,
        timestampMs: Long,
        dataHash: String,
        durationMs: Long,
    ): Int

    /** Inserts each row or, when its natural key exists, keeps the longer duration. Answers how many were new. */
    @Transaction
    open suspend fun record(rows: List<AwEventEntity>): Int {
        var inserted = 0
        for (row in rows) {
            if (insertOrIgnore(row) != IGNORED) {
                inserted++
            } else {
                extend(row.bucketId, row.timestampMs, row.dataHash, row.durationMs)
            }
        }
        return inserted
    }

    @Query("SELECT * FROM aw_event WHERE bucket_id = :bucketId AND timestamp_ms >= :from AND timestamp_ms < :to ORDER BY timestamp_ms, id")
    abstract suspend fun between(
        bucketId: String,
        from: Long,
        to: Long,
    ): List<AwEventEntity>

    @Query("SELECT * FROM aw_event WHERE bucket_id = :bucketId ORDER BY timestamp_ms DESC, id DESC LIMIT 1")
    abstract suspend fun last(bucketId: String): AwEventEntity?

    @Query("DELETE FROM aw_event WHERE timestamp_ms < :before")
    abstract suspend fun deleteBefore(before: Long): Int

    private companion object {
        const val IGNORED = -1L
    }
}
