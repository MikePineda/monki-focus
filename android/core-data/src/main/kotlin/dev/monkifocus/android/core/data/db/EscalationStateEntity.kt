// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import androidx.room.ColumnInfo
import androidx.room.Embedded
import androidx.room.Entity
import androidx.room.PrimaryKey
import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.EscalationState
import dev.monkifocus.android.core.domain.rules.FrictionType

/** `escalation.schema.json#/$defs/state` (SEMANTICS.md §7), one row per target group. */
@Entity(tableName = MonkiTables.ESCALATION_STATE)
data class EscalationStateEntity(
    @PrimaryKey @ColumnInfo(name = "target_group") val targetGroup: String,
    val phase: EscalationPhase,
    @ColumnInfo(name = "attempt_count") val attemptCount: Int,
    @ColumnInfo(name = "last_attempt_at") val lastAttemptAt: Long?,
    @ColumnInfo(name = "last_activity_at") val lastActivityAt: Long?,
    @ColumnInfo(name = "broken_count") val brokenCount: Int,
    @ColumnInfo(name = "last_friction_type") val lastFrictionType: FrictionType?,
    @Embedded(prefix = "gate_") val gate: GateColumns?,
    @ColumnInfo(name = "pause_ends_at") val pauseEndsAt: Long?,
    @ColumnInfo(name = "pending_extension") val pendingExtension: Boolean,
    @ColumnInfo(name = "intention_expires_at") val intentionExpiresAt: Long?,
    @ColumnInfo(name = "override_ready_at") val overrideReadyAt: Long?,
    @ColumnInfo(name = "override_ends_at") val overrideEndsAt: Long?,
) {
    fun toDomain(): EscalationState =
        EscalationState(
            targetGroup = targetGroup,
            phase = phase,
            attemptCount = attemptCount,
            lastAttemptAt = lastAttemptAt?.let(::instantOfMillis),
            lastActivityAt = lastActivityAt?.let(::instantOfMillis),
            brokenCount = brokenCount,
            lastFrictionType = lastFrictionType,
            gate = gate?.toDomain(),
            pauseEndsAt = pauseEndsAt?.let(::instantOfMillis),
            pendingExtension = pendingExtension,
            intentionExpiresAt = intentionExpiresAt?.let(::instantOfMillis),
            overrideReadyAt = overrideReadyAt?.let(::instantOfMillis),
            overrideEndsAt = overrideEndsAt?.let(::instantOfMillis),
        )

    companion object {
        fun of(state: EscalationState): EscalationStateEntity =
            EscalationStateEntity(
                targetGroup = state.targetGroup,
                phase = state.phase,
                attemptCount = state.attemptCount,
                lastAttemptAt = state.lastAttemptAt?.let(::millisOf),
                lastActivityAt = state.lastActivityAt?.let(::millisOf),
                brokenCount = state.brokenCount,
                lastFrictionType = state.lastFrictionType,
                gate = state.gate?.let(GateColumns::of),
                pauseEndsAt = state.pauseEndsAt?.let(::millisOf),
                pendingExtension = state.pendingExtension,
                intentionExpiresAt = state.intentionExpiresAt?.let(::millisOf),
                overrideReadyAt = state.overrideReadyAt?.let(::millisOf),
                overrideEndsAt = state.overrideEndsAt?.let(::millisOf),
            )
    }
}
