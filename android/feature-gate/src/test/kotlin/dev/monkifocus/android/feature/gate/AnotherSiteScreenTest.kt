// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import dev.monkifocus.android.core.domain.rules.ExplanationKey
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.feature.gate.state.GateUiState
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/** A blocked page in a browser never traps: another site and BACK are one tap away, Close too. */
@RunWith(RobolectricTestRunner::class)
class AnotherSiteScreenTest {
    @get:Rule
    val compose = createComposeRule()

    private val calls = mutableListOf<String>()
    private val inBrowser =
        GateActions(
            onClose = { calls += "close" },
            onEmergency = { calls += "emergency" },
            onAnotherSite = { calls += "another_site" },
            onGoBack = { calls += "go_back" },
        )

    @Test
    fun a_blocked_page_in_a_browser_offers_another_site_and_go_back() {
        compose.setContent { MonkiTheme { GateScreen(blocked(ExplanationKey.BLOCKED_BY_RULE), inBrowser) } }

        compose.onNodeWithText("Go to another site").assertExists()
        compose.onNodeWithTag(GateTestTags.ANOTHER_SITE).performScrollTo().performClick()
        compose.onNodeWithTag(GateTestTags.GO_BACK).performScrollTo().performClick()
        compose.onNodeWithTag(GateTestTags.CLOSE).performScrollTo().assertIsEnabled()

        assertEquals(listOf("another_site", "go_back"), calls)
    }

    @Test
    fun every_screen_the_user_may_leave_by_choice_offers_another_site_in_a_browser() {
        var state by mutableStateOf<GateUiState>(pausing())
        compose.setContent { MonkiTheme { GateScreen(state, inBrowser) } }

        listOf(pausing(), asking(), blocked(ExplanationKey.BLOCKED_BY_RULE), timeout()).forEach { screen ->
            state = screen
            compose.waitForIdle()
            compose.onNodeWithTag(GateTestTags.ANOTHER_SITE).assertExists()
            compose.onNodeWithTag(GateTestTags.GO_BACK).assertExists()
        }
    }

    @Test
    fun outside_a_browser_no_other_site_is_offered() {
        compose.setContent { MonkiTheme { GateScreen(blocked(ExplanationKey.BLOCKED_BY_RULE), GateActions(onClose = {})) } }

        compose.onNodeWithTag(GateTestTags.ANOTHER_SITE).assertDoesNotExist()
        compose.onNodeWithTag(GateTestTags.GO_BACK).assertDoesNotExist()
    }

    @Test
    fun the_address_entry_goes_to_what_was_typed() {
        var opened: String? = null
        compose.setContent { MonkiTheme { AnotherSiteScreen(onGo = { opened = it }, onCancel = {}, onClose = {}) } }

        compose.onNodeWithText("Where to instead?").assertExists()
        compose.onNodeWithTag(GateTestTags.GO).assertIsNotEnabled()
        compose.onNodeWithTag(GateTestTags.ADDRESS).performTextInput("  weather.example ")
        compose.onNodeWithTag(GateTestTags.GO).performScrollTo().performClick()

        assertEquals("weather.example", opened)
    }

    @Test
    fun the_address_entry_can_be_cancelled_or_closed() {
        compose.setContent {
            MonkiTheme { AnotherSiteScreen(onGo = { calls += "go" }, onCancel = { calls += "cancel" }, onClose = { calls += "close" }) }
        }

        compose.onNodeWithTag(GateTestTags.CANCEL_ADDRESS).performScrollTo().performClick()
        compose.onNodeWithTag(GateTestTags.CLOSE).performScrollTo().performClick()

        assertEquals(listOf("cancel", "close"), calls)
    }
}
