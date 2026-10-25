// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.decision

import dev.monkifocus.android.core.domain.rules.DailyUsage
import dev.monkifocus.android.core.domain.rules.DecisionState
import dev.monkifocus.android.core.domain.rules.EscalationState
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.VerifiedUnlock

/**
 * The in-memory inputs of `decide` the service holds between events: the
 * rule set in force and the escalation state of every group (the service is
 * the only writer of escalation while it runs, so its copy is authoritative
 * and writes go to Room behind it). Budgets need the day's usage, which the
 * analytics work package feeds; until then [usage] is null and budgets wait.
 */
data class ProtectionSnapshot(
    val ruleset: Ruleset,
    val escalation: List<EscalationState> = emptyList(),
    val guardianLinked: Boolean = false,
    val unlocks: List<VerifiedUnlock> = emptyList(),
    val usage: DailyUsage? = null,
) {
    val decisionState: DecisionState get() = DecisionState(escalation, usage, unlocks, guardianLinked)

    /** This snapshot with [state] replacing its group's previous state. */
    fun with(state: EscalationState): ProtectionSnapshot =
        copy(escalation = escalation.filter { it.targetGroup != state.targetGroup } + state)
}
