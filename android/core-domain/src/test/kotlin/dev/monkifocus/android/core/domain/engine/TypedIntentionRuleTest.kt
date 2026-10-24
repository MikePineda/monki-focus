// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.FrictionType
import dev.monkifocus.android.core.domain.rules.Gate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** The typed-intention rule (SEMANTICS.md §7.5), the Kotlin twin of `TypedIntentionRule.test.ts`. */
class TypedIntentionRuleTest {
    private fun gateAt(
        level: Int,
        requiresTypedIntention: Boolean = level >= 2,
    ) = Gate(level, 15, FrictionType.REFLECT, requiresTypedIntention, requiresGuardianKey = false)

    @Test
    fun from_level_two_three_words_and_a_new_text_are_required() {
        assertEquals(3, MIN_INTENTION_WORDS)
        assertEquals(IntentionRequirements(minWords = 3, mustDifferFromPrevious = true), intentionRequirements(gateAt(2)))
        assertEquals(IntentionRequirements(minWords = 3, mustDifferFromPrevious = true), intentionRequirements(gateAt(3)))
    }

    @Test
    fun below_level_two_and_on_the_extension_gate_nothing_is_typed() {
        val none = IntentionRequirements(minWords = 0, mustDifferFromPrevious = false)
        assertEquals(none, intentionRequirements(gateAt(0)))
        assertEquals(none, intentionRequirements(gateAt(1)))
        assertEquals(none, intentionRequirements(gateAt(2, requiresTypedIntention = false)))
        assertTrue(isIntentionAcceptable("", "reply to a message", gateAt(1)))
    }

    @Test
    fun two_words_are_not_enough_and_three_are() {
        assertFalse(isIntentionAcceptable("check messages", null, gateAt(2)))
        assertTrue(isIntentionAcceptable("check my messages", null, gateAt(2)))
    }

    @Test
    fun punctuation_and_repeated_spaces_are_not_words() {
        assertEquals(3, intentionWordCount("  read ,  -  the   news !! "))
        assertFalse(isIntentionAcceptable("read — news …", null, gateAt(2)))
    }

    @Test
    fun the_same_text_as_last_time_is_rejected_ignoring_case_and_spacing() {
        val previous = "Reply to a message"
        assertFalse(isIntentionAcceptable("  reply TO a   message ", previous, gateAt(3)))
        assertFalse(isIntentionAcceptable("　reply to a\tmessage﻿", previous, gateAt(3)))
        assertTrue(isIntentionAcceptable("reply to the message", previous, gateAt(3)))
    }

    @Test
    fun a_blank_previous_text_imposes_nothing() {
        assertTrue(isIntentionAcceptable("reply to a message", "   ", gateAt(2)))
    }

    @Test
    fun words_follow_unicode_word_boundaries() {
        assertEquals(3, intentionWordCount("revisar el correo"))
        assertEquals(3, intentionWordCount("don't scroll now"))
    }

    /** Expected counts are what `Intl.Segmenter('en', {granularity: 'word'})` with `isWordLike` returns (Node 22, ICU). */
    @Test
    fun word_counts_agree_with_the_typescript_segmenter() {
        val mismatches =
            AGREEING.mapNotNull { (text, expected) ->
                intentionWordCount(text).takeIf { it != expected }?.let { "\"$text\": $it != $expected" }
            }

        assertEquals(emptyList<String>(), mismatches)
    }

    /**
     * Where the desktop JDK's word rules differ from UAX #29 (see
     * `TypedIntentionRule.kt`). Android's `BreakIterator` is ICU, so on a device
     * these give the TypeScript count; this test runs on the JVM and pins the
     * known gap so a JDK change shows up here.
     */
    @Test
    fun known_jdk_divergences_from_the_typescript_segmenter() {
        DIVERGING.forEach { (text, typescript, jvm) ->
            assertEquals("\"$text\" (TypeScript counts $typescript)", jvm, intentionWordCount(text))
        }
    }

    private companion object {
        val AGREEING =
            listOf(
                "" to 0,
                "   " to 0,
                "check messages" to 2,
                "check my messages" to 3,
                "  read ,  -  the   news !! " to 3,
                "read — news …" to 2,
                "  reply TO a   message " to 4,
                "reply to the message" to 4,
                "revisar el correo" to 3,
                "don't scroll now" to 3,
                "e.g. this one" to 3,
                "U.S.A. trip plan" to 3,
                "3.14 is pi" to 3,
                "1,000 words now" to 3,
                "check 2 emails" to 3,
                "📱📱📱" to 0,
                "check 📱 now" to 2,
                "👍🏽 ok go" to 2,
                "😀 smile 😀 smile" to 2,
                "我想 看 新闻" to 3,
                "日本語のテキスト" to 3,
                "한국어 문장 입니다" to 3,
                "foo_bar baz qux" to 3,
                "_ _ _" to 0,
                "½ ² Ⅻ" to 1,
                "café naïve résumé" to 3,
                "école ok fine" to 3,
                "a.b.c d e" to 3,
                "hello...world again" to 3,
                "#hashtag @user test" to 3,
                "C++ and C#" to 3,
                "x=1 y=2 z=3" to 6,
                "مرحبا بك في" to 3,
                "שלום עולם טוב" to 3,
                "Привет мир сегодня" to 3,
                "tab\tseparated\nwords" to 3,
                "a b c" to 3,
                "'quoted' \"words\" here" to 3,
                "(paren) [bracket] {brace}" to 3,
                "rock'n'roll music now" to 3,
                "l'homme est là" to 3,
                "über straße groß" to 3,
                "ΟΔΟΣ οδός δρόμος" to 3,
                "١٢٣ ٤٥٦ ٧٨٩" to 3,
                "a1 b2 c3" to 3,
                "..." to 0,
                "--- *** ///" to 0,
                "reply to one message" to 4,
                "check the opening hours" to 4,
                "look up one recipe" to 4,
            )

        /** Text, the TypeScript (ICU) count, the desktop JDK count. */
        val DIVERGING =
            listOf(
                Triple("it’s a test", 3, 4),
                Triple("well-known fact here", 4, 3),
                Triple("我想看新闻", 3, 1),
                Triple("カタカナ ひらがな 漢字", 6, 3),
                Triple("สวัสดีครับ วันนี้", 4, 2),
            )
    }
}
