// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.change

import dev.monkifocus.android.core.domain.rules.Ruleset

/** What decisions use right now ([effective]) and what waits to apply ([pending]). */
data class RulesState(
    val effective: Ruleset,
    val pending: PendingRuleChange?,
) {
    /** The set the user configured: the pending one while it waits, else the effective one. */
    val configured: Ruleset get() = pending?.ruleset ?: effective
}
