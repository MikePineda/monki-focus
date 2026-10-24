// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate.state

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class IntentionRuleTest {
    private val optional = GateUiState.Asking(TARGET, level = 1, requiresTypedIntention = false, requiresGuardianKey = false)
    private val required = optional.copy(level = 2, requiresTypedIntention = true, previousIntention = "check the opening hours")

    @Test
    fun words_are_counted_like_the_engine_so_punctuation_is_not_a_word() {
        assertEquals(0, IntentionRule.wordCount("   "))
        assertEquals(3, IntentionRule.wordCount("  reply   to\tone "))
        assertEquals(2, IntentionRule.wordCount("reply , now !"))
        assertFalse(IntentionRule.canContinue(required, "reply , now !", minutes = 5))
    }

    @Test
    fun the_duration_has_no_default_so_continue_waits_for_a_choice() {
        assertFalse(IntentionRule.canContinue(optional, "", minutes = null))
        assertTrue(IntentionRule.canContinue(optional, "", minutes = 10))
    }

    @Test
    fun only_the_offered_durations_count() {
        assertEquals(listOf(5, 10, 15), IntentionRule.DURATION_MINUTES)
        assertFalse(IntentionRule.canContinue(optional, "", minutes = 7))
    }

    @Test
    fun from_level_two_the_intention_needs_three_words() {
        assertFalse(IntentionRule.canContinue(required, "reply now", minutes = 5))
        assertTrue(IntentionRule.canContinue(required, "reply to one message", minutes = 5))
    }

    @Test
    fun from_level_two_the_intention_must_differ_from_the_previous_one() {
        assertFalse(IntentionRule.canContinue(required, "  Check the   OPENING hours ", minutes = 15))
        assertTrue(IntentionRule.meetsTypedRule("check the opening hours", previous = null))
    }

    @Test
    fun a_step_that_needs_the_guardian_key_cannot_continue_here() {
        val guarded = required.copy(level = 3, requiresGuardianKey = true)

        assertFalse(IntentionRule.canContinue(guarded, "reply to one message", minutes = 5))
    }
}
