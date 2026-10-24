// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert

@Dao
abstract class ActivityBlockDao {
    /** Insert or replace `seconds` by primary (natural) key. */
    @Upsert
    abstract suspend fun upsert(rows: List<ActivityBlockEntity>)

    @Delete
    abstract suspend fun delete(rows: List<ActivityBlockEntity>)

    /** The canonical block order (SEMANTICS.md §10.6); text compares by code unit (BINARY). */
    @Query(
        "SELECT * FROM activity_block WHERE block_start >= :from AND block_start < :to " +
            "ORDER BY block_start, device_id, activity_key, category_path, source, level",
    )
    abstract suspend fun between(
        from: Long,
        to: Long,
    ): List<ActivityBlockEntity>

    @Query("SELECT * FROM activity_block WHERE device_id = :deviceId AND block_start >= :from AND block_start < :to")
    abstract suspend fun deviceRange(
        deviceId: String,
        from: Long,
        to: Long,
    ): List<ActivityBlockEntity>

    /**
     * Makes [rows] the device's content in `[from, to)`, atomically. Answers
     * the rows that are new or whose seconds changed.
     */
    @Transaction
    open suspend fun replaceRange(
        deviceId: String,
        from: Long,
        to: Long,
        rows: List<ActivityBlockEntity>,
    ): List<ActivityBlockEntity> {
        require(rows.all { it.deviceId == deviceId && it.blockStart in from until to }) { "Block outside the replaced range" }
        val existing = deviceRange(deviceId, from, to)
        val changed = rows.filter { row -> existing.none { it.sameKeyAs(row) && it.seconds == row.seconds } }
        val stale = existing.filter { old -> rows.none { it.sameKeyAs(old) } }
        upsert(rows)
        delete(stale)
        return changed
    }
}
