// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.Serializable

/**
 * `escalation.schema.json#/$defs/state`: the escalation state machine of one
 * target group (SEMANTICS.md §7). Every field is always present (no defaults,
 * so strict decoding rejects a missing one); unused fields are null. Instants
 * are UTC text (`2026-10-25T23:00:00Z`).
 */
@Serializable
data class EscalationState(
    val targetGroup: String,
    val phase: EscalationPhase,
    val attemptCount: Int,
    val lastAttemptAt: String?,
    val lastActivityAt: String?,
    val brokenCount: Int,
    val lastFrictionType: FrictionType?,
    val gate: Gate?,
    val pauseEndsAt: String?,
    val pendingExtension: Boolean,
    val intentionExpiresAt: String?,
    val overrideReadyAt: String?,
    val overrideEndsAt: String?,
)
