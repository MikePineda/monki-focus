// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import dev.monkifocus.android.core.domain.ports.Intention
import dev.monkifocus.android.core.domain.ports.IntentionOutcome

/** One intention and how it ended. The typed text is never stored, only its word count. */
@Entity(
    tableName = MonkiTables.INTENTION,
    indices = [Index(value = ["target_group", "ends_at"]), Index(value = ["started_at"])],
)
data class IntentionEntity(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "target_group") val targetGroup: String,
    val minutes: Int,
    @ColumnInfo(name = "typed_words") val typedWords: Int,
    @ColumnInfo(name = "guardian_key_verified") val guardianKeyVerified: Boolean,
    @ColumnInfo(name = "started_at") val startedAt: Long,
    @ColumnInfo(name = "ends_at") val endsAt: Long,
    val outcome: IntentionOutcome?,
    @ColumnInfo(name = "closed_at") val closedAt: Long?,
) {
    fun toDomain(): Intention =
        Intention(
            id = id,
            targetGroup = targetGroup,
            minutes = minutes,
            typedWords = typedWords,
            guardianKeyVerified = guardianKeyVerified,
            startedAt = instantOfMillis(startedAt),
            endsAt = instantOfMillis(endsAt),
            outcome = outcome,
            closedAt = closedAt?.let(::instantOfMillis),
        )

    companion object {
        fun of(intention: Intention): IntentionEntity =
            IntentionEntity(
                id = intention.id,
                targetGroup = intention.targetGroup,
                minutes = intention.minutes,
                typedWords = intention.typedWords,
                guardianKeyVerified = intention.guardianKeyVerified,
                startedAt = millisOf(intention.startedAt),
                endsAt = millisOf(intention.endsAt),
                outcome = intention.outcome,
                closedAt = intention.closedAt?.let(::millisOf),
            )
    }
}
