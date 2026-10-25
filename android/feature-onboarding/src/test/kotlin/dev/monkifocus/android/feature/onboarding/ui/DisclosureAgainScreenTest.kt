// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.ui

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import dev.monkifocus.android.core.ui.MonkiTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** A changed disclosure is shown again to an armed user; declining leads to Exit and unlink, never a silent disarm. */
@RunWith(RobolectricTestRunner::class)
class DisclosureAgainScreenTest {
    @get:Rule
    val compose = createComposeRule()

    private val calls = mutableListOf<String>()

    private fun show() {
        compose.setContent {
            MonkiTheme { DisclosureAgainScreen(onAgree = { calls += "agree" }, onNotNow = { calls += "not_now" }) }
        }
    }

    @Test
    fun the_whole_disclosure_shows_with_the_note_that_not_now_keeps_protection() {
        show()

        compose.onNodeWithText("only the text of the address bar", substring = true).assertExists()
        compose.onNodeWithText("Not now does not turn protection off — Exit and unlink does.").performScrollTo().assertExists()
        compose.onNodeWithText("your protection stays on meanwhile", substring = true).assertExists()
    }

    @Test
    fun both_answers_reach_the_host() {
        show()

        compose.onNodeWithTag(OnboardingTestTags.NOT_NOW).performScrollTo().performClick()
        compose.onNodeWithTag(OnboardingTestTags.AGREE).performScrollTo().performClick()

        assertEquals(listOf("not_now", "agree"), calls)
    }

    @Test
    @Config(qualifiers = "es")
    fun the_note_reads_in_spanish() {
        show()

        compose.onNodeWithText("Ahora no no apaga la protección: eso lo hace Salir y desvincular.").performScrollTo().assertExists()
    }
}
