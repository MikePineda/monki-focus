// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.Gate
import java.text.BreakIterator
import java.util.Locale

/*
 * The typed-intention rule (SEMANTICS.md §7.5). When a gate requires a typed
 * intention (from L2, never on the short extension gate) the text MUST have
 * at least 3 words and MUST differ from the previous intention text of the
 * group, compared after trimming, collapsing whitespace and lower-casing. A
 * word is a word-like segment of Unicode default word boundaries (UAX #29),
 * so punctuation and repeated spaces never count. Only the word count reaches
 * `nextEscalation` (`commit.typedWords`); the text itself never leaves the device.
 *
 * Segments come from `java.text.BreakIterator`. On Android it is backed by
 * ICU, the library behind `Intl.Segmenter` in the TypeScript engine, so the
 * counts agree. The desktop JDK ships its own older rules, which differ from
 * UAX #29 on a few inputs: a hyphenated compound (`well-known`) is one word,
 * a typographic apostrophe (`it’s`) splits a word, and runs of CJK or Thai
 * script are not split by dictionary. `TypedIntentionRuleTest` pins both the
 * agreeing and the diverging cases.
 */

const val MIN_INTENTION_WORDS = 3

/** What a gate asks of a typed intention. */
data class IntentionRequirements(
    val minWords: Int,
    val mustDifferFromPrevious: Boolean,
) {
    companion object {
        /** From L2: three words and a new text. */
        val TYPED: IntentionRequirements = IntentionRequirements(MIN_INTENTION_WORDS, mustDifferFromPrevious = true)

        /** Below L2 and on the extension gate: nothing is typed. */
        val NONE: IntentionRequirements = IntentionRequirements(0, mustDifferFromPrevious = false)
    }
}

/** Fixed locale: word boundaries must not depend on the device language. */
private val SEGMENTER_LOCALE: Locale = Locale.ENGLISH

/** JavaScript's `\s` (Unicode `Zs` plus tab, line terminators and U+FEFF), for the same comparison as TypeScript. */
private val WHITESPACE = Regex("[\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]+")

fun intentionRequirements(gate: Gate): IntentionRequirements =
    if (gate.requiresTypedIntention) IntentionRequirements.TYPED else IntentionRequirements.NONE

/**
 * A segment is word-like when it holds a letter or a decimal or letter
 * number, the code points UAX #29 builds words from (ICU's `isWordLike`);
 * punctuation, symbols and emoji are not.
 */
private fun isWordLike(segment: String): Boolean =
    segment.codePoints().anyMatch { codePoint ->
        val type = Character.getType(codePoint)
        Character.isLetter(codePoint) ||
            type == Character.DECIMAL_DIGIT_NUMBER.toInt() ||
            type == Character.LETTER_NUMBER.toInt()
    }

/** Words in `text`: word-like segments of the platform word segmenter. */
fun intentionWordCount(text: String): Int {
    val iterator = BreakIterator.getWordInstance(SEGMENTER_LOCALE)
    iterator.setText(text)
    var count = 0
    var start = iterator.first()
    var end = iterator.next()
    while (end != BreakIterator.DONE) {
        if (isWordLike(text.substring(start, end))) count += 1
        start = end
        end = iterator.next()
    }
    return count
}

/** Trimmed, whitespace runs collapsed to one space, lower-cased without a locale (`Locale.ROOT`). */
private fun comparable(text: String): String =
    text
        .replace(WHITESPACE, " ")
        .removePrefix(" ")
        .removeSuffix(" ")
        .lowercase()

fun isIntentionAcceptable(
    text: String,
    previous: String?,
    requirements: IntentionRequirements,
): Boolean {
    if (intentionWordCount(text) < requirements.minWords) return false
    if (!requirements.mustDifferFromPrevious || previous == null || comparable(previous).isEmpty()) return true
    return comparable(text) != comparable(previous)
}

fun isIntentionAcceptable(
    text: String,
    previous: String?,
    gate: Gate,
): Boolean = isIntentionAcceptable(text, previous, intentionRequirements(gate))
