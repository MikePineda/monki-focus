// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update

@Dao
interface UnlockLedgerDao {
    @Query("SELECT * FROM unlock_ledger WHERE jti = :jti")
    suspend fun get(jti: String): UnlockLedgerEntity?

    @Query("SELECT * FROM unlock_ledger ORDER BY jti")
    suspend fun all(): List<UnlockLedgerEntity>

    /** Strict insert: an existing jti aborts. */
    @Insert
    suspend fun insert(row: UnlockLedgerEntity)

    /** Answers -1 when the jti exists; the stored entry is never overwritten. */
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertOrIgnore(row: UnlockLedgerEntity): Long

    @Update
    suspend fun update(row: UnlockLedgerEntity): Int

    @Query("DELETE FROM unlock_ledger WHERE jti IN (:jtis)")
    suspend fun delete(jtis: List<String>): Int
}
