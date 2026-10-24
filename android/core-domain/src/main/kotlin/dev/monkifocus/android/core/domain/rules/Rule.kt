// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.Serializable

/** `rule.schema.json`: one rule of a rule set. */
@Serializable
data class Rule(
    val id: String,
    val target: Target,
    val mode: RuleMode,
    /** Empty means always active. */
    val schedules: List<RuleSchedule>,
    val dailyBudgetMinutes: Int? = null,
    val enabled: Boolean,
    val note: String? = null,
)
