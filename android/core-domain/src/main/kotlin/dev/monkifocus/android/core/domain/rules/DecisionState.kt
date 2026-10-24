// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.Serializable

/** `decision-context.schema.json#/$defs/state`: every input of `decide` besides the rule set and the clock. */
@Serializable
data class DecisionState(
    /** At most one state per target group; a missing group is the initial idle state. */
    val escalation: List<EscalationState>,
    val usage: DailyUsage?,
    val unlocks: List<VerifiedUnlock>,
    val guardianLinked: Boolean,
)
