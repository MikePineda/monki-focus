// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import dev.monkifocus.android.core.domain.analytics.ActivityBlock
import dev.monkifocus.android.core.domain.analytics.ActivitySource

/**
 * A 5-minute block, keyed by its natural key. SQLite treats NULLs in a key as
 * distinct, so a null `activityKey` is stored as `''` (never a valid key: it
 * must start with a letter or digit), which also sorts it first.
 */
@Entity(
    tableName = MonkiTables.ACTIVITY_BLOCK,
    primaryKeys = ["device_id", "block_start", "activity_key", "category_path", "source", "level"],
    indices = [Index(value = ["block_start"])],
)
data class ActivityBlockEntity(
    @ColumnInfo(name = "device_id") val deviceId: String,
    @ColumnInfo(name = "block_start") val blockStart: Long,
    @ColumnInfo(name = "activity_key") val activityKey: String,
    @ColumnInfo(name = "category_path") val categoryPath: String,
    val source: ActivitySource,
    val level: Int,
    val seconds: Int,
) {
    fun sameKeyAs(other: ActivityBlockEntity): Boolean = copy(seconds = 0) == other.copy(seconds = 0)

    fun toDomain(): ActivityBlock =
        ActivityBlock(
            deviceId = deviceId,
            blockStart = instantOfMillis(blockStart),
            activityKey = activityKey.ifEmpty { null },
            categoryPath = categoryPath,
            level = level,
            source = source,
            seconds = seconds,
        )

    companion object {
        /** The stored form of a null activity key. */
        const val NO_ACTIVITY_KEY = ""

        fun of(block: ActivityBlock): ActivityBlockEntity =
            ActivityBlockEntity(
                deviceId = block.deviceId,
                blockStart = millisOf(block.blockStart),
                activityKey = block.activityKey ?: NO_ACTIVITY_KEY,
                categoryPath = block.categoryPath,
                source = block.source,
                level = block.level,
                seconds = block.seconds,
            )
    }
}
