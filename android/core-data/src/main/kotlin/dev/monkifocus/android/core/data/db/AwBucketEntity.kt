// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import dev.monkifocus.android.core.domain.analytics.ActivityBucket
import dev.monkifocus.android.core.domain.analytics.BucketType

/** An ActivityWatch bucket. `data` is the bucket's (empty) metadata object, kept for export parity. */
@Entity(tableName = MonkiTables.AW_BUCKET)
data class AwBucketEntity(
    @PrimaryKey val id: String,
    val type: BucketType,
    val client: String,
    val hostname: String,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    val data: String = EMPTY_OBJECT,
) {
    fun toDomain(): ActivityBucket = ActivityBucket(id, type, client, hostname, instantOfMillis(createdAt))

    companion object {
        const val EMPTY_OBJECT = "{}"

        fun of(bucket: ActivityBucket): AwBucketEntity =
            AwBucketEntity(bucket.id, bucket.type, bucket.client, bucket.hostname, millisOf(bucket.created))
    }
}
