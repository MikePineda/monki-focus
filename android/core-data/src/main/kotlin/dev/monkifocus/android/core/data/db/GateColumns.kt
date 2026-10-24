// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import androidx.room.ColumnInfo
import dev.monkifocus.android.core.domain.rules.FrictionType
import dev.monkifocus.android.core.domain.rules.Gate

/** The last gate of an escalation state, embedded as `gate_*` columns (all null without a gate). */
data class GateColumns(
    val level: Int,
    @ColumnInfo(name = "pause_seconds") val pauseSeconds: Int,
    @ColumnInfo(name = "friction_type") val frictionType: FrictionType,
    @ColumnInfo(name = "requires_typed_intention") val requiresTypedIntention: Boolean,
    @ColumnInfo(name = "requires_guardian_key") val requiresGuardianKey: Boolean,
) {
    fun toDomain(): Gate = Gate(level, pauseSeconds, frictionType, requiresTypedIntention, requiresGuardianKey)

    companion object {
        fun of(gate: Gate): GateColumns =
            GateColumns(gate.level, gate.pauseSeconds, gate.frictionType, gate.requiresTypedIntention, gate.requiresGuardianKey)
    }
}
