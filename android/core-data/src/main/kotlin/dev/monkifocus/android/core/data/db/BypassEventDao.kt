// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface BypassEventDao {
    /** Answers -1 when the id is already queued. */
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertOrIgnore(row: BypassEventEntity): Long

    @Query("SELECT * FROM bypass_event WHERE reported_at IS NULL ORDER BY occurred_at, id LIMIT :limit")
    suspend fun unreported(limit: Int): List<BypassEventEntity>

    @Query("UPDATE bypass_event SET reported_at = :reportedAt WHERE id IN (:ids) AND reported_at IS NULL")
    suspend fun markReported(
        ids: List<String>,
        reportedAt: Long,
    ): Int

    @Query("SELECT * FROM bypass_event WHERE occurred_at >= :from AND occurred_at < :to ORDER BY occurred_at, id")
    suspend fun occurredBetween(
        from: Long,
        to: Long,
    ): List<BypassEventEntity>

    @Query("SELECT * FROM bypass_event WHERE id = :id")
    suspend fun get(id: String): BypassEventEntity?

    @Query("DELETE FROM bypass_event WHERE reported_at IS NOT NULL AND occurred_at < :before")
    suspend fun purgeReportedBefore(before: Long): Int
}
