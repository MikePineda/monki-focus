// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import dev.monkifocus.android.core.domain.ports.IntentionOutcome

@Dao
interface IntentionDao {
    /** Aborts on an existing id. */
    @Insert
    suspend fun insert(row: IntentionEntity)

    /** Closes only an open intention; answers the rows changed (0 or 1). */
    @Query("UPDATE intention SET outcome = :outcome, closed_at = :closedAt WHERE id = :id AND closed_at IS NULL")
    suspend fun close(
        id: String,
        outcome: IntentionOutcome,
        closedAt: Long,
    ): Int

    @Query("SELECT * FROM intention WHERE target_group = :targetGroup AND closed_at IS NULL ORDER BY started_at DESC, id DESC LIMIT 1")
    suspend fun open(targetGroup: String): IntentionEntity?

    @Query("SELECT * FROM intention WHERE started_at >= :from AND started_at < :to ORDER BY started_at, id")
    suspend fun startedBetween(
        from: Long,
        to: Long,
    ): List<IntentionEntity>
}
