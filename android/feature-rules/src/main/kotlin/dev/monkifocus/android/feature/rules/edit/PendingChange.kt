// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.edit

import dev.monkifocus.android.core.domain.rules.Target

/** One part of the configured rule set that does not apply yet. */
sealed interface PendingChange {
    data class RuleAdded(
        val ruleId: String,
        val target: Target,
    ) : PendingChange

    data class RuleChanged(
        val ruleId: String,
        val target: Target,
    ) : PendingChange

    data class RuleRemoved(
        val ruleId: String,
        val target: Target,
    ) : PendingChange

    data object BedtimeChanged : PendingChange

    data object WorkHoursChanged : PendingChange

    data object CategoriesChanged : PendingChange

    data object TimeZoneChanged : PendingChange
}
