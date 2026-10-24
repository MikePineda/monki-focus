// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.feature.gate.state.GateUiState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class AskingScreenTest {
    @get:Rule
    val compose = createComposeRule()

    private var committed: Pair<String, Int>? = null

    private fun show(state: GateUiState.Asking) {
        compose.setContent {
            MonkiTheme {
                GateScreen(state, GateActions(onClose = {}, onContinue = { intention, minutes -> committed = intention to minutes }))
            }
        }
    }

    @Test
    fun close_is_enabled_while_continue_waits_for_a_duration() {
        show(asking(level = 1))

        compose.onNodeWithTag(GateTestTags.CLOSE).assertIsEnabled()
        compose.onNodeWithTag(GateTestTags.CONTINUE).performScrollTo().assertIsNotEnabled()
        compose.onNodeWithText("Choose how long first.").assertExists()
    }

    @Test
    fun below_level_two_choosing_a_duration_is_enough_to_continue() {
        show(asking(level = 1))

        compose.onNodeWithText("10 min").performScrollTo().performClick()
        compose.onNodeWithText("10 min").assertIsSelected()
        compose
            .onNodeWithTag(GateTestTags.CONTINUE)
            .performScrollTo()
            .assertIsEnabled()
            .performClick()

        assertEquals("" to 10, committed)
    }

    @Test
    fun from_level_two_continue_also_waits_for_a_three_word_intention() {
        show(asking(level = 2))

        compose.onNodeWithText("5 min").performScrollTo().performClick()
        compose.onNodeWithTag(GateTestTags.CONTINUE).performScrollTo().assertIsNotEnabled()
        compose.onNodeWithText("Write your intention first.").assertExists()

        compose.onNodeWithTag(GateTestTags.INTENTION).performScrollTo().performTextInput("reply to one message")
        compose.onNodeWithText("Words: 4").assertExists()
        compose
            .onNodeWithTag(GateTestTags.CONTINUE)
            .performScrollTo()
            .assertIsEnabled()
            .performClick()

        assertEquals("reply to one message" to 5, committed)
    }

    @Test
    fun a_repeat_of_the_previous_intention_keeps_continue_disabled() {
        show(asking(level = 2, previousIntention = "reply to one message"))

        compose.onNodeWithText("15 min").performScrollTo().performClick()
        compose.onNodeWithTag(GateTestTags.INTENTION).performScrollTo().performTextInput("Reply to one message")

        compose.onNodeWithTag(GateTestTags.CONTINUE).performScrollTo().assertIsNotEnabled()
        assertNull(committed)
    }

    @Test
    fun a_step_that_needs_the_guardian_key_says_so_and_cannot_continue() {
        show(asking(level = 3, requiresGuardianKey = true))

        compose.onNodeWithText("5 min").performScrollTo().performClick()
        compose.onNodeWithTag(GateTestTags.INTENTION).performScrollTo().performTextInput("check the opening hours")

        compose.onNodeWithTag(GateTestTags.CONTINUE).performScrollTo().assertIsNotEnabled()
        compose.onNodeWithText("This step needs your guardian’s key.").assertExists()
        compose.onNodeWithTag(GateTestTags.CLOSE).assertIsEnabled()
    }
}
