// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import dev.monkifocus.android.core.domain.ports.BypassEvent

/** A queued bypass event; `details` is a JSON object of codes (no URLs, titles or node text). */
@Entity(
    tableName = MonkiTables.BYPASS_EVENT,
    indices = [Index(value = ["occurred_at"]), Index(value = ["reported_at"])],
)
data class BypassEventEntity(
    @PrimaryKey val id: String,
    val kind: String,
    @ColumnInfo(name = "occurred_at") val occurredAt: Long,
    @ColumnInfo(name = "detected_at") val detectedAt: Long,
    val details: Map<String, String>,
    @ColumnInfo(name = "reported_at") val reportedAt: Long? = null,
) {
    fun toDomain(): BypassEvent = BypassEvent(id, kind, instantOfMillis(occurredAt), instantOfMillis(detectedAt), details)

    companion object {
        fun of(event: BypassEvent): BypassEventEntity =
            BypassEventEntity(
                id = event.id,
                kind = event.kind,
                occurredAt = millisOf(event.occurredAt),
                detectedAt = millisOf(event.detectedAt),
                details = event.details,
            )
    }
}
