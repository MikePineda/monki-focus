// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import dev.monkifocus.android.core.domain.rules.ExplanationKey
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.feature.gate.state.GateUiState
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/** Blocked, emergency wait, timeout and bedtime: leaving is always one tap away. */
@RunWith(RobolectricTestRunner::class)
class BlockingScreensTest {
    @get:Rule
    val compose = createComposeRule()

    private val calls = mutableListOf<String>()
    private val actions =
        GateActions(
            onClose = { calls += "close" },
            onContinue = { _, _ -> calls += "continue" },
            onEmergency = { calls += "emergency" },
            onCancelEmergency = { calls += "cancel" },
            onExtend = { calls += "extend" },
        )

    @Test
    fun close_is_enabled_on_every_gate_screen() {
        var state by mutableStateOf<GateUiState>(pausing())
        compose.setContent { MonkiTheme { GateScreen(state, actions) } }

        everyGateScreen().forEach { screen ->
            state = screen
            compose.waitForIdle()
            compose.onNodeWithTag(GateTestTags.CLOSE).assertIsEnabled()
        }
    }

    @Test
    fun a_spent_budget_offers_only_close_and_emergency() {
        compose.setContent { MonkiTheme { GateScreen(blocked(ExplanationKey.BUDGET_EXHAUSTED), actions) } }

        compose.onNodeWithText("Time’s up for example.com today").assertExists()
        compose.onNodeWithText("Today’s time for this is used up. It resets at midnight.").assertExists()
        compose.onNodeWithTag(GateTestTags.CONTINUE).assertDoesNotExist()
        compose.onNodeWithTag(GateTestTags.EMERGENCY).performScrollTo().performClick()
        compose.onNodeWithTag(GateTestTags.CLOSE).performScrollTo().performClick()

        assertEquals(listOf("emergency", "close"), calls)
    }

    @Test
    fun an_engine_error_offers_only_close() {
        compose.setContent { MonkiTheme { GateScreen(blocked(ExplanationKey.ENGINE_ERROR), actions) } }

        compose.onNodeWithText("Something went wrong, so this stays closed to be safe.").assertExists()
        compose.onNodeWithTag(GateTestTags.EMERGENCY).assertDoesNotExist()
        compose.onNodeWithTag(GateTestTags.CLOSE).assertIsEnabled()
    }

    @Test
    fun the_emergency_wait_counts_two_minutes_and_says_the_guardian_will_be_notified() {
        compose.setContent { MonkiTheme { GateScreen(emergencyWait(remainingSeconds = 120), actions) } }

        compose
            .onNodeWithTag(GateTestTags.COUNTDOWN)
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion, LiveRegionMode.Polite))
            .assertContentDescriptionEquals("Time left: 2:00")
        compose.onNodeWithText("2:00").assertDoesNotExist()
        compose.onNodeWithText("Your guardian will be notified.").assertExists()
        compose.onNodeWithTag(GateTestTags.CANCEL_EMERGENCY).performScrollTo().performClick()

        assertEquals(listOf("cancel"), calls)
    }

    @Test
    fun without_a_guardian_the_emergency_wait_says_it_is_recorded() {
        compose.setContent { MonkiTheme { GateScreen(emergencyWait(guardianLinked = false), actions) } }

        compose.onNodeWithText("This is recorded as emergency access.").assertExists()
    }

    @Test
    fun the_timeout_card_offers_leave_or_five_more_minutes_that_count_as_broken() {
        compose.setContent { MonkiTheme { GateScreen(timeout(), actions) } }

        compose.onNodeWithText("Your 10 min for “reply to one message” are up.").assertExists()
        compose.onNodeWithText("Counts as a broken intention · next pause will be 30 s").assertExists()
        compose.onNodeWithTag(GateTestTags.EXTEND).performScrollTo().performClick()
        compose
            .onNodeWithTag(GateTestTags.CLOSE)
            .assertTextEquals("Leave")
            .assertIsEnabled()
            .performScrollTo()
            .performClick()

        assertEquals(listOf("extend", "close"), calls)
    }

    @Test
    fun the_bedtime_cover_offers_close_and_emergency() {
        compose.setContent { MonkiTheme { GateScreen(bedtime(), actions) } }

        compose.onNodeWithText("It’s bedtime").assertExists()
        compose.onNodeWithTag(GateTestTags.EMERGENCY).performScrollTo().performClick()

        assertEquals(listOf("emergency"), calls)
    }

    @Test
    fun the_bedtime_cover_without_an_end_time_uses_the_engine_explanation() {
        compose.setContent { MonkiTheme { GateScreen(bedtime(endMinuteOfDay = null), actions) } }

        compose.onNodeWithText("It’s bedtime. Apps you limited stay closed until morning.").assertExists()
    }
}
