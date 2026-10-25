// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.change

import dev.monkifocus.android.core.domain.rules.Ruleset

/** The whole configured rule set while any part of it loosens, and the UTC instant it applies in full. */
data class PendingRuleChange(
    val ruleset: Ruleset,
    val effectiveFrom: String,
)
