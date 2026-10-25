// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.change

import dev.monkifocus.android.core.domain.validation.RejectionCode

/** What the rules screen tells the user after an action (the UI maps each to copy). */
sealed interface RulesMessage {
    data object Saved : RulesMessage

    data class SavedPending(
        val effectiveFrom: String,
    ) : RulesMessage

    data object Cancelled : RulesMessage

    data class Rejected(
        val code: RuleChangeRejection,
    ) : RulesMessage

    data class ImportInvalid(
        val code: RejectionCode,
        val location: String?,
    ) : RulesMessage

    data object Exported : RulesMessage

    data object FileFailed : RulesMessage

    companion object {
        fun of(outcome: RuleChangeOutcome): RulesMessage =
            when (outcome) {
                is RuleChangeOutcome.Applied -> Saved
                is RuleChangeOutcome.Pending -> SavedPending(outcome.effectiveFrom)
                is RuleChangeOutcome.Rejected -> Rejected(outcome.code)
            }
    }
}
