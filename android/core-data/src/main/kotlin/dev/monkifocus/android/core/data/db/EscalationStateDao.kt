// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert

@Dao
interface EscalationStateDao {
    @Query("SELECT * FROM escalation_state ORDER BY target_group")
    suspend fun all(): List<EscalationStateEntity>

    @Query("SELECT * FROM escalation_state WHERE target_group = :targetGroup")
    suspend fun get(targetGroup: String): EscalationStateEntity?

    /** Upserts every row in one transaction. */
    @Upsert
    suspend fun upsert(rows: List<EscalationStateEntity>)

    @Query("DELETE FROM escalation_state WHERE target_group = :targetGroup")
    suspend fun delete(targetGroup: String): Int
}
