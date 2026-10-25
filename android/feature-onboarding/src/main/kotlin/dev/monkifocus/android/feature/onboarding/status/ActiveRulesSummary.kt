// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.status

import dev.monkifocus.android.core.domain.rules.Ruleset

/**
 * The Status screen's line about the rules in force: how many are on, the
 * bedtime window when it is on (`HH:MM`, in the rule set's zone) and, when a
 * change waits, the UTC instant it applies from.
 */
data class ActiveRulesSummary(
    val enabledRules: Int,
    val bedtimeStart: String?,
    val bedtimeEnd: String?,
    val pendingFrom: String?,
) {
    companion object {
        fun of(
            effective: Ruleset,
            pendingFrom: String?,
        ): ActiveRulesSummary {
            val bedtime = effective.bedtime.takeIf { it.enabled && it.days.isNotEmpty() }
            return ActiveRulesSummary(effective.rules.count { it.enabled }, bedtime?.start, bedtime?.end, pendingFrom)
        }
    }
}
