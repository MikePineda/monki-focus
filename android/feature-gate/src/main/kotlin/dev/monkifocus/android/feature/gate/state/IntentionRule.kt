// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate.state

import dev.monkifocus.android.core.domain.engine.IntentionRequirements
import dev.monkifocus.android.core.domain.engine.MIN_INTENTION_WORDS
import dev.monkifocus.android.core.domain.engine.intentionWordCount
import dev.monkifocus.android.core.domain.engine.isIntentionAcceptable

/**
 * When "Continue" may be pressed on the intention prompt (DESIGN.md, Text
 * field and Segmented control; SEMANTICS.md §7.3 `commit`): a duration is
 * always required and has no default; from L2 the typed intention follows
 * the domain rule of §7.5 (at least [MIN_WORDS] words, not a repeat of the
 * previous one); a step that needs the guardian's key cannot continue here.
 */
object IntentionRule {
    const val MIN_WORDS = MIN_INTENTION_WORDS

    /** The duration picker's options, in minutes. */
    val DURATION_MINUTES: List<Int> = listOf(5, 10, 15)

    /** Words as the engine counts them (§7.5): punctuation and repeated spaces are not words. */
    fun wordCount(text: String): Int = intentionWordCount(text)

    /** The typed-intention rule of L2+: enough words and not a repeat of [previous] (case and spacing ignored). */
    fun meetsTypedRule(
        text: String,
        previous: String?,
    ): Boolean = isIntentionAcceptable(text, previous, IntentionRequirements.TYPED)

    fun canContinue(
        state: GateUiState.Asking,
        text: String,
        minutes: Int?,
    ): Boolean =
        minutes in DURATION_MINUTES &&
            !state.requiresGuardianKey &&
            (!state.requiresTypedIntention || meetsTypedRule(text, state.previousIntention))
}
