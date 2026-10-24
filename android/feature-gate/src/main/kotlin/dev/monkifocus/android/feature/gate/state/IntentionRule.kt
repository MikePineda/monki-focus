// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate.state

import java.util.Locale

/**
 * When "Continue" may be pressed on the intention prompt (DESIGN.md, Text
 * field and Segmented control; SEMANTICS.md §7.3 `commit`): a duration is
 * always required and has no default; from L2 the typed intention needs at
 * least [MIN_WORDS] words and must differ from the previous one; a step that
 * needs the guardian's key cannot continue here.
 */
object IntentionRule {
    const val MIN_WORDS = 3

    /** The duration picker's options, in minutes. */
    val DURATION_MINUTES: List<Int> = listOf(5, 10, 15)

    private val WORD = Regex("""\S+""")

    fun wordCount(text: String): Int = WORD.findAll(text).count()

    /** The typed-intention rule of L2+: enough words and not a repeat of [previous] (case and spacing ignored). */
    fun meetsTypedRule(
        text: String,
        previous: String?,
    ): Boolean = wordCount(text) >= MIN_WORDS && (previous == null || normalised(text) != normalised(previous))

    fun canContinue(
        state: GateUiState.Asking,
        text: String,
        minutes: Int?,
    ): Boolean =
        minutes in DURATION_MINUTES &&
            !state.requiresGuardianKey &&
            (!state.requiresTypedIntention || meetsTypedRule(text, state.previousIntention))

    private fun normalised(text: String): String = WORD.findAll(text).joinToString(" ") { it.value }.lowercase(Locale.ROOT)
}
