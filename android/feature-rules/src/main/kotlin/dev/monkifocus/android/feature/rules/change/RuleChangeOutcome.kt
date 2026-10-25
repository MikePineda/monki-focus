// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.change

/** The answer to one proposed rule set. */
sealed interface RuleChangeOutcome {
    /** Everything only tightened: it applies now and nothing waits. */
    data class Applied(
        val state: RulesState,
    ) : RuleChangeOutcome

    /** Something loosens: the tightening parts apply now, the whole set from [effectiveFrom] (UTC). */
    data class Pending(
        val effectiveFrom: String,
        val state: RulesState,
    ) : RuleChangeOutcome

    /** Nothing was saved. */
    data class Rejected(
        val code: RuleChangeRejection,
    ) : RuleChangeOutcome
}
