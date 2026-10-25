// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.edit

import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Schedule
import dev.monkifocus.android.core.domain.rules.ScheduleRef
import dev.monkifocus.android.core.domain.rules.Target
import dev.monkifocus.android.feature.rules.change.RulesState

/**
 * One row of the rules list: target, mode, schedule and budget of a rule of
 * the configured set, and whether its configured version still [waiting]
 * (added, changed or removed in a pending change). Allowed communities have
 * their own section and are left out.
 */
data class RuleSummary(
    val id: String,
    val target: Target,
    val mode: RuleMode,
    val schedule: ScheduleSummary,
    val dailyBudgetMinutes: Int?,
    val enabled: Boolean,
    val waiting: Boolean,
) {
    companion object {
        fun rowsOf(state: RulesState): List<RuleSummary> {
            val waiting = state.pending?.let { PendingChanges.ruleIds(PendingChanges.between(state.effective, it.ruleset)) }.orEmpty()
            return state.configured.rules
                .filter { RulesetEdits.allowedSubredditOf(it) == null }
                .map { of(it, it.id in waiting) }
        }

        fun of(
            rule: Rule,
            waiting: Boolean,
        ): RuleSummary = RuleSummary(rule.id, rule.target, rule.mode, scheduleOf(rule), rule.dailyBudgetMinutes, rule.enabled, waiting)

        private fun scheduleOf(rule: Rule): ScheduleSummary {
            val windows = rule.schedules.count { it is Schedule }
            val withWorkHours = rule.schedules.any { it is ScheduleRef }
            return when {
                rule.schedules.isEmpty() -> ScheduleSummary.Always
                windows == 0 -> ScheduleSummary.WorkHours
                else -> ScheduleSummary.Windows(windows, withWorkHours)
            }
        }
    }
}
