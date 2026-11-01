// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.gate

import dev.monkifocus.android.core.domain.engine.BEDTIME_GROUP
import dev.monkifocus.android.core.domain.rules.Decision
import dev.monkifocus.android.core.domain.rules.ReasonCode

/**
 * The escalation group a decision's restriction belongs to (SEMANTICS.md
 * §7): its rule id, or `bedtime` for a bedtime block, the relaxed-night gate
 * and its intention (§5.2 step 4, no rule id), and the override that lifts
 * them. Null when no restriction is named (no rule, an engine error): then
 * nothing can be lifted from the gate, and the way out is "Exit and unlink".
 */
object GateGroup {
    private val BEDTIME_REASONS =
        setOf(ReasonCode.SCHEDULE_BEDTIME, ReasonCode.EMERGENCY_ACTIVE, ReasonCode.INTENTION_REQUIRED, ReasonCode.INTENTION_ACTIVE)

    fun of(decision: Decision): String? {
        decision.ruleId?.let { return it }
        return if (decision.reason in BEDTIME_REASONS) BEDTIME_GROUP else null
    }
}
