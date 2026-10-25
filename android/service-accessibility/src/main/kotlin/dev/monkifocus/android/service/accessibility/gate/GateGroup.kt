// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.gate

import dev.monkifocus.android.core.domain.engine.BEDTIME_GROUP
import dev.monkifocus.android.core.domain.rules.Decision
import dev.monkifocus.android.core.domain.rules.ReasonCode

/**
 * The escalation group a decision's restriction belongs to (SEMANTICS.md
 * §7): its rule id, or `bedtime` for a bedtime block and the override that
 * lifts it. Null when no restriction is named (no rule, an engine error):
 * then nothing can be lifted from the gate, and the way out is "Exit and
 * unlink".
 */
object GateGroup {
    fun of(decision: Decision): String? {
        decision.ruleId?.let { return it }
        return if (decision.reason == ReasonCode.SCHEDULE_BEDTIME || decision.reason == ReasonCode.EMERGENCY_ACTIVE) BEDTIME_GROUP else null
    }
}
